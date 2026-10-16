const crypto = require('crypto');
const {
  supabaseAdmin,
  createScopedClient,
} = require('../../config/supabaseClient');
const AppError = require('../../utils/AppError');

/**
 * In-memory fallback cache to ensure instant zero-latency retrieval
 * and resilience against database network timeouts
 */
const inMemoryReviews = new Map();

/**
 * Normalize file path for dictionary keying
 */
function normalizePath(filePath) {
  if (!filePath) return '';
  return String(filePath).replace(/\\/g, '/').toLowerCase().trim();
}

/**
 * 1. Save Complete Review Audit Result into Supabase
 *
 * Persists:
 * - reviews: audit session record (health score, grade, summary, partial_mode flag, owner)
 * - review_files: evaluated source files
 * - review_issues: linked security vulnerabilities, AST smells, and AI diffs
 *
 * @param {Object} reviewData
 * @param {string} [reviewData.id] - Review UUID
 * @param {string} [reviewData.userId] - Authenticated user UUID
 * @param {string} [reviewData.user_id]
 * @param {string} [reviewData.guestSessionId] - Guest sandbox token
 * @param {string} [reviewData.guest_session_id]
 * @param {string} reviewData.projectName - Project name
 * @param {string} [reviewData.project_name]
 * @param {string} reviewData.sourceType - 'direct' | 'github'
 * @param {string} [reviewData.source_type]
 * @param {string} [reviewData.repoUrl] - GitHub repository URL
 * @param {string} [reviewData.repo_url]
 * @param {number} [reviewData.healthScore=100] - Calculated health score
 * @param {number} [reviewData.health_score]
 * @param {string} [reviewData.grade='A+'] - Letter grade
 * @param {string} [reviewData.status='completed'] - Session status
 * @param {string} [reviewData.summary] - Human-readable audit summary
 * @param {boolean} [reviewData.partialMode=false] - Partial analysis mode flag
 * @param {boolean} [reviewData.partial_mode]
 * @param {Array<Object>} [reviewData.files=[]] - Evaluated files
 * @param {Array<Object>} [reviewData.issues=[]] - Normalized issues
 * @returns {Promise<string>} Stored review UUID
 */
async function saveReviewResult(reviewData = {}) {
  const reviewId = reviewData.id || crypto.randomUUID();

  const userId = reviewData.userId || reviewData.user_id || null;
  // If user is authenticated, user_id takes strict priority and guest_session_id is null
  let guestSessionId = userId
    ? null
    : (reviewData.guestSessionId || reviewData.guest_session_id || null);

  // The database enforces: CHECK (user_id IS NOT NULL OR guest_session_id IS NOT NULL)
  if (!userId && !guestSessionId) {
    guestSessionId = `guest_auto_${crypto.randomUUID()}`;
  }

  const projectName =
    reviewData.projectName || reviewData.project_name || 'unnamed-project';
  const sourceType =
    reviewData.sourceType || reviewData.source_type || 'direct';
  const repoUrl = reviewData.repoUrl || reviewData.repo_url || null;

  const rawScore =
    reviewData.healthScore !== undefined
      ? reviewData.healthScore
      : reviewData.health_score !== undefined
      ? reviewData.health_score
      : 100;
  const healthScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  const grade = reviewData.grade || 'A+';
  const status = (reviewData.status || 'completed').toLowerCase().trim();
  const summary = reviewData.summary || '';
  const partialMode = !!(
    reviewData.partialMode !== undefined
      ? reviewData.partialMode
      : reviewData.partial_mode
  );

  // 1. Insert review session row into `reviews`
  const { error: reviewErr } = await supabaseAdmin.from('reviews').insert({
    id: reviewId,
    user_id: userId,
    guest_session_id: guestSessionId,
    project_name: projectName,
    source_type: sourceType,
    repo_url: repoUrl,
    health_score: healthScore,
    grade,
    status,
    summary,
    partial_mode: partialMode,
  });

  if (reviewErr) {
    throw new AppError(
      `Database error persisting review session: ${reviewErr.message}`,
      500,
      { code: reviewErr.code }
    );
  }

  // 2. Insert batch rows into `review_files`
  const rawFiles = Array.isArray(reviewData.files) ? reviewData.files : [];
  const fileIdMap = new Map(); // normalizedFilePath -> file UUID
  const fileRows = [];

  for (const f of rawFiles) {
    const fileId = f.id || crypto.randomUUID();
    const filePath = f.path || f.file_path || 'snippet.js';
    const norm = normalizePath(filePath);

    fileIdMap.set(norm, fileId);

    fileRows.push({
      id: fileId,
      review_id: reviewId,
      file_path: filePath,
      language: f.language || 'javascript',
      lines_count: f.linesCount || f.lines_count || f.lines || 0,
      issues_count: f.issuesCount || f.issues_count || 0,
    });
  }

  if (fileRows.length > 0) {
    const { error: filesErr } = await supabaseAdmin
      .from('review_files')
      .insert(fileRows);

    if (filesErr) {
      throw new AppError(
        `Database error persisting review files: ${filesErr.message}`,
        500,
        { code: filesErr.code }
      );
    }
  }

  // Default fallback file ID if issues lack specific file link
  const defaultFileId =
    fileRows.length > 0 ? fileRows[0].id : crypto.randomUUID();

  // If no files were provided but issues exist, create a fallback file row
  if (fileRows.length === 0 && Array.isArray(reviewData.issues) && reviewData.issues.length > 0) {
    await supabaseAdmin.from('review_files').insert({
      id: defaultFileId,
      review_id: reviewId,
      file_path: 'snippet.js',
      language: 'javascript',
      lines_count: 0,
      issues_count: reviewData.issues.length,
    });
  }

  // 3. Insert batch rows into `review_issues`
  const rawIssues = Array.isArray(reviewData.issues) ? reviewData.issues : [];
  const issueRows = [];

  for (const iss of rawIssues) {
    const issueFile = iss.file || iss.file_path || '';
    const norm = normalizePath(issueFile);
    const fileId = fileIdMap.get(norm) || defaultFileId;

    const rawSev = String(iss.severity || 'MEDIUM').toUpperCase().trim();
    const severity = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].includes(rawSev)
      ? rawSev
      : 'MEDIUM';

    const rawCat = String(iss.category || 'QUALITY').toUpperCase().trim();
    const category = ['SYNTAX', 'SECURITY', 'QUALITY', 'OPTIMIZATION'].includes(rawCat)
      ? rawCat
      : 'QUALITY';

    const rawEngine = String(iss.engine_source || iss.source || 'HYBRID').toUpperCase().trim();
    const engineSource = ['STATIC', 'GEMINI', 'HYBRID'].includes(rawEngine)
      ? rawEngine
      : 'HYBRID';

    issueRows.push({
      id: iss.id || crypto.randomUUID(),
      review_id: reviewId,
      file_id: fileId,
      line_number: typeof iss.line === 'number' ? iss.line : iss.line_number || 1,
      severity,
      category,
      rule_id: iss.ruleId || iss.rule_id || 'GENERAL_ISSUE',
      title: iss.title || 'Review Finding',
      description: iss.description || iss.explanation || '',
      remediation: iss.remediation || iss.explanation || '',
      diff_before: iss.diff_before || iss.evidence || '',
      diff_after: iss.diff_after || '',
      engine_source: engineSource,
    });
  }

  if (issueRows.length > 0) {
    const { error: issuesErr } = await supabaseAdmin
      .from('review_issues')
      .insert(issueRows);

    if (issuesErr) {
      throw new AppError(
        `Database error persisting review issues: ${issuesErr.message}`,
        500,
        { code: issuesErr.code }
      );
    }
  }

  // Store in inMemoryReviews for instant zero-latency resilience
  inMemoryReviews.set(reviewId, {
    id: reviewId,
    user_id: userId,
    guest_session_id: guestSessionId,
    project_name: projectName,
    source_type: sourceType,
    repo_url: repoUrl,
    health_score: healthScore,
    healthScore,
    score: healthScore,
    grade,
    status,
    summary,
    partial_mode: partialMode,
    files: fileRows,
    issues: issueRows,
    created_at: new Date().toISOString(),
  });

  return reviewId;
}

/**
 * 2. Fetch Review with Joined Files and Issues Ensuring RLS / Ownership
 *
 * @param {string} reviewId - UUID of the review session
 * @param {Object} [userOrGuestContext] - Client security context
 * @param {string} [userOrGuestContext.userId] - Authenticated user UUID
 * @param {string} [userOrGuestContext.guestSessionId] - Guest sandbox session token
 * @param {string} [userOrGuestContext.accessToken] - User JWT for RLS client
 * @param {boolean} [userOrGuestContext.isAdmin=false] - Bypass ownership constraint
 * @returns {Promise<Object|null>} Review object with files and issues arrays
 */
async function getReviewById(reviewId, userOrGuestContext = {}) {
  if (!reviewId) {
    throw new AppError('Review ID is required.', 400);
  }

  let client = supabaseAdmin;

  const accessToken = userOrGuestContext.accessToken;
  const guestSessionId =
    userOrGuestContext.guestSessionId ||
    userOrGuestContext.guest_session_id ||
    null;
  const userId =
    userOrGuestContext.userId || userOrGuestContext.user_id || null;
  const isAdmin = !!userOrGuestContext.isAdmin;

  // Use scoped RLS client if access token or guest token provided and not elevated admin
  if ((accessToken || guestSessionId) && !isAdmin) {
    client = createScopedClient({ accessToken, guestSessionId });
  }

  // 1. Fetch review record
  let query = client.from('reviews').select('*').eq('id', reviewId);

  // Enforce ownership checks explicitly when not admin
  if (!isAdmin && (userId || guestSessionId)) {
    if (userId && guestSessionId) {
      query = query.or(`user_id.eq.${userId},guest_session_id.eq.${guestSessionId}`);
    } else if (userId) {
      query = query.eq('user_id', userId);
    } else if (guestSessionId) {
      query = query.eq('guest_session_id', guestSessionId);
    }
  }

  const getCachedIfAllowed = () => {
    const cached = inMemoryReviews.get(reviewId);
    if (!cached) return null;
    if (isAdmin) return cached;
    if (guestSessionId && cached.guest_session_id && cached.guest_session_id !== guestSessionId) {
      return null;
    }
    if (userId && cached.user_id && cached.user_id !== userId) {
      return null;
    }
    return cached;
  };

  let review = null;
  try {
    const { data, error: reviewErr } = await query.maybeSingle();
    if (reviewErr) {
      const cached = getCachedIfAllowed();
      if (cached) return cached;
      throw new AppError(
        `Database error retrieving review: ${reviewErr.message}`,
        500
      );
    }
    review = data;
  } catch (err) {
    const cached = getCachedIfAllowed();
    if (cached) return cached;
    throw err;
  }

  if (!review) {
    const cached = getCachedIfAllowed();
    if (cached) return cached;
    return null;
  }

  // 2. Fetch associated review_files
  const { data: files, error: filesErr } = await client
    .from('review_files')
    .select('*')
    .eq('review_id', reviewId)
    .order('file_path', { ascending: true });

  if (filesErr) {
    throw new AppError(
      `Database error retrieving review files: ${filesErr.message}`,
      500
    );
  }

  // 3. Fetch associated review_issues
  const { data: issues, error: issuesErr } = await client
    .from('review_issues')
    .select('*')
    .eq('review_id', reviewId)
    .order('line_number', { ascending: true });

  if (issuesErr) {
    throw new AppError(
      `Database error retrieving review issues: ${issuesErr.message}`,
      500
    );
  }

  return {
    ...review,
    score: review.health_score !== undefined ? Number(review.health_score) : review.score,
    healthScore: review.health_score !== undefined ? Number(review.health_score) : review.score,
    files: files || [],
    issues: issues || [],
  };
}

/**
 * 3. Delete Review by ID (Verifies Database Cascade Deletion)
 *
 * @param {string} reviewId
 * @param {Object} [userOrGuestContext]
 * @returns {Promise<boolean>} True if deleted
 */
async function deleteReviewById(reviewId, userOrGuestContext = {}) {
  if (!reviewId) return false;

  inMemoryReviews.delete(reviewId);

  let client = supabaseAdmin;
  if (userOrGuestContext.guestSessionId && !userOrGuestContext.isAdmin) {
    client = createScopedClient({
      guestSessionId: userOrGuestContext.guestSessionId,
    });
  }

  const { error } = await client.from('reviews').delete().eq('id', reviewId);

  if (error) {
    throw new AppError(`Failed to delete review: ${error.message}`, 500);
  }

  return true;
}

/**
 * 4. Fetch Review History for User or Guest Session
 *
 * @param {Object} [userOrGuestContext]
 * @returns {Promise<Array<Object>>} List of reviews with aggregated issues summary
 */
async function getReviewHistory(userOrGuestContext = {}) {
  let client = supabaseAdmin;
  const guestSessionId =
    userOrGuestContext.guestSessionId ||
    userOrGuestContext.guest_session_id ||
    null;
  const userId =
    userOrGuestContext.userId || userOrGuestContext.user_id || null;
  const isAdmin = !!userOrGuestContext.isAdmin;

  if (guestSessionId && !isAdmin) {
    client = createScopedClient({ guestSessionId });
  }

  let query = client
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false });

  if (!isAdmin) {
    if (userId) {
      // Authenticated user: strictly fetch reviews belonging to user_id
      query = query.eq('user_id', userId);
    } else if (guestSessionId) {
      // Guest session: strictly fetch reviews belonging to guest_session_id
      query = query.eq('guest_session_id', guestSessionId);
    } else {
      return [];
    }
  }

  let reviews = [];
  try {
    const { data, error: reviewsErr } = await query;
    if (reviewsErr) {
      throw new AppError(
        `Database error retrieving review history: ${reviewsErr.message}`,
        500
      );
    }
    reviews = data || [];
  } catch (err) {
    // In-memory fallback
    const all = Array.from(inMemoryReviews.values());
    reviews = all.filter((r) => {
      if (isAdmin) return true;
      if (userId) return r.user_id === userId;
      if (guestSessionId) return r.guest_session_id === guestSessionId;
      return false;
    });
  }

  if (!reviews || reviews.length === 0) {
    return [];
  }

  const reviewIds = reviews.map((r) => r.id);

  // Fetch associated review_files for these reviews
  const { data: files } = await client
    .from('review_files')
    .select('id, review_id, file_path, language, lines_count, issues_count')
    .in('review_id', reviewIds);

  // Fetch associated review_issues for these reviews
  const { data: issues } = await client
    .from('review_issues')
    .select('id, review_id, severity, category, rule_id')
    .in('review_id', reviewIds);

  const filesMap = new Map();
  if (files) {
    for (const f of files) {
      if (!filesMap.has(f.review_id)) filesMap.set(f.review_id, []);
      filesMap.get(f.review_id).push(f);
    }
  }

  const issuesMap = new Map();
  if (issues) {
    for (const iss of issues) {
      if (!issuesMap.has(iss.review_id)) issuesMap.set(iss.review_id, []);
      issuesMap.get(iss.review_id).push(iss);
    }
  }

  return reviews.map((rev) => {
    const revFiles = filesMap.get(rev.id) || [];
    const revIssues = issuesMap.get(rev.id) || [];

    const severityCounts = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFO: 0,
    };

    for (const iss of revIssues) {
      const sev = String(iss.severity || 'MEDIUM').toUpperCase();
      if (severityCounts[sev] !== undefined) {
        severityCounts[sev]++;
      }
    }

    const primaryLanguage =
      revFiles.length > 0 && revFiles[0].language
        ? revFiles[0].language
        : 'JavaScript';

    return {
      ...rev,
      score: rev.health_score !== undefined ? Number(rev.health_score) : rev.score,
      healthScore: rev.health_score !== undefined ? Number(rev.health_score) : rev.score,
      language: primaryLanguage,
      files_count: revFiles.length,
      issues_count: revIssues.length,
      severity_counts: severityCounts,
      files: revFiles,
      issues: revIssues,
    };
  });
}

module.exports = {
  saveReviewResult,
  getReviewById,
  deleteReviewById,
  getReviewHistory,
  normalizePath,
};

