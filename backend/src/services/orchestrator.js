const crypto = require('crypto');
const { validateDirectSnippet, validateGitHubUrl } = require('../utils/validators');
const { resolveDnsAndValidate } = require('../middleware/security');
const { ingestRepository } = require('./github/ingestionManager');
const { analyzeFile } = require('./analysis/staticAnalyzer');
const { reviewCodeWithGemini } = require('./ai/aiReviewer');
const { mergeAndDeduplicate } = require('./analysis/findingsNormalizer');
const { calculateScore } = require('./analysis/scoringEngine');
const { saveReviewResult } = require('./persistence/reviewRepository');
const AppError = require('../utils/AppError');
const { supabaseAdmin } = require('../config/supabaseClient');

/**
 * Map language name to typical file extension
 */
function getExtensionForLanguage(lang = '') {
  switch (lang.toLowerCase().trim()) {
    case 'typescript':
    case 'ts':
      return 'ts';
    case 'python':
    case 'py':
      return 'py';
    case 'java':
      return 'java';
    case 'cpp':
    case 'c++':
      return 'cpp';
    case 'javascript':
    case 'js':
    default:
      return 'js';
  }
}

/**
 * Sanitize filename to lowercase snake_case
 * e.g. "BHARU" -> "bharu.js", "Student Management System" -> "student_management_system.js"
 *
 * @param {string} name - Raw project title or file path
 * @param {string} [defaultExt='js'] - File extension fallback
 * @returns {string} Lowercase snake_case filename
 */
function sanitizeToSnakeCaseFilename(name, defaultExt = 'js') {
  if (!name || typeof name !== 'string') return `source_code.${defaultExt}`;

  let baseName = name.trim();
  let ext = defaultExt;

  const lastDot = baseName.lastIndexOf('.');
  if (lastDot > 0 && lastDot < baseName.length - 1) {
    ext = baseName.slice(lastDot + 1).toLowerCase();
    baseName = baseName.slice(0, lastDot);
  }

  const sanitized = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return `${sanitized || 'source_code'}.${ext}`;
}

/**
 * Execute Re:Code Unified Code Review Pipeline
 *
 * Steps:
 * 1. Normalize & validate input parameters (direct snippet or GitHub repo)
 * 2. Extract candidate source files in-memory
 * 3. Run deterministic static AST analyzer across all files
 * 4. Run Google Gemini AI review (or enter partial analysis mode if key missing/timed out)
 * 5. Merge, deduplicate, and normalize findings into HYBRID, STATIC, and GEMINI issues
 * 6. Compute explainable health score, letter grade, and category percentages
 * 7. Return canonical review results payload (and optionally persist to database)
 *
 * @param {Object} params
 * @param {string} params.sourceType - 'direct' | 'github' (or source_type)
 * @param {string|Object} [params.payload] - Direct code snippet string or repo object
 * @param {string} [params.content] - Direct snippet content (if not in payload)
 * @param {string} [params.url] - GitHub repository URL (if not in payload)
 * @param {string} [params.language='javascript'] - Programming language
 * @param {string} [params.projectName] - Project title / identifier
 * @param {string} [params.branch='main'] - Git branch
 * @param {string} [params.guestSessionId] - Guest session header/UUID
 * @param {string} [params.userId] - Authenticated user UUID
 * @param {Object} [params.options] - Execution options (e.g. skipAi, timeoutMs)
 * @returns {Promise<Object>} Canonical review results payload
 */
async function executeReviewPipeline({
  sourceType,
  source_type,
  payload,
  content,
  code,
  url,
  repo_url,
  repoUrl,
  language = 'javascript',
  projectName,
  project_name,
  branch = 'main',
  guestSessionId,
  guest_session_id,
  userId,
  user_id,
  options = {},
} = {}) {
  // --------------------------------------------------------------------------
  // STEP 1: Normalize & Validate Inputs
  // --------------------------------------------------------------------------
  const effectiveSourceType = (sourceType || source_type || '').toLowerCase().trim();
  const effectiveGuestSessionId = guestSessionId || guest_session_id || null;
  const effectiveUserId = userId || user_id || null;

  if (!effectiveSourceType) {
    throw new AppError(
      "Missing required 'sourceType' parameter. Must be 'direct' or 'github'.",
      400,
      { field: 'sourceType', allowed: ['direct', 'github'] }
    );
  }

  let effectiveProjectName = projectName || project_name || '';
  let validatedTarget = null;
  let targetUrl = null;

  if (effectiveSourceType === 'direct') {
    const rawContent =
      typeof payload === 'string'
        ? payload
        : (payload && (payload.content || payload.code)) || content || code || '';

    const rawLang =
      (payload && payload.language) || language || 'javascript';

    validatedTarget = validateDirectSnippet(rawContent, rawLang, effectiveProjectName);
    effectiveProjectName = validatedTarget.projectName;
  } else if (effectiveSourceType === 'github') {
    targetUrl =
      typeof payload === 'string'
        ? payload
        : (payload && (payload.url || payload.repo_url || payload.repoUrl)) ||
          url ||
          repo_url ||
          repoUrl ||
          '';

    validatedTarget = validateGitHubUrl(targetUrl);
    await resolveDnsAndValidate(new URL(validatedTarget.url).hostname);
    effectiveProjectName = effectiveProjectName || validatedTarget.projectName;
  } else {
    throw new AppError(
      `Unsupported sourceType '${effectiveSourceType}'. Expected 'direct' or 'github'.`,
      400,
      { field: 'sourceType', received: effectiveSourceType }
    );
  }

  // --------------------------------------------------------------------------
  // STEP 2: Extract Candidate Files In-Memory
  // --------------------------------------------------------------------------
  let candidateFiles = [];

  if (effectiveSourceType === 'direct') {
    const ext = getExtensionForLanguage(validatedTarget.language);
    const rawPath =
      (payload && (payload.filePath || payload.file_path)) ||
      effectiveProjectName ||
      'source_code';
    const fileName = sanitizeToSnakeCaseFilename(rawPath, ext);

    candidateFiles = [
      {
        path: fileName,
        language: validatedTarget.language,
        content: validatedTarget.content,
        lines: validatedTarget.linesCount,
      },
    ];
  } else if (effectiveSourceType === 'github') {
    const targetBranch = (payload && payload.branch) || branch || 'main';
    const ingestion = await ingestRepository({
      owner: validatedTarget.owner,
      repo: validatedTarget.repo,
      branch: targetBranch,
    });
    candidateFiles = ingestion.files;
  }

  if (candidateFiles.length === 0) {
    throw new AppError('No eligible source code files found for analysis.', 400);
  }

  // --------------------------------------------------------------------------
  // STEP 3: Run Static AST Analyzer Across All Files
  // --------------------------------------------------------------------------
  const allStaticFindings = [];
  const fileStaticMap = new Map();

  for (const file of candidateFiles) {
    const findings = analyzeFile(file.path, file.content, file.language);
    fileStaticMap.set(file.path, findings);
    allStaticFindings.push(...findings);
  }

  // --------------------------------------------------------------------------
  // STEP 4: Run Gemini AI Review (or Fallback to Partial Analysis Mode)
  // --------------------------------------------------------------------------
  const allAiFindings = [];
  let overallPartialMode = false;
  let partialModeReason = null;

  if (options.skipAi) {
    overallPartialMode = true;
    partialModeReason = 'SKIPPED_BY_OPTIONS';
  } else {
    for (const file of candidateFiles) {
      const fileStaticFindings = fileStaticMap.get(file.path) || [];
      const hasSyntaxError = fileStaticFindings.some(
        (f) => f.ruleId === 'PARSER_ERROR' || f.category === 'SYNTAX'
      );

      const aiResult = await reviewCodeWithGemini({
        filePath: file.path,
        codeContent: file.content,
        language: file.language,
        staticFindings: fileStaticFindings,
        hasSyntaxError,
        timeoutMs: options.timeoutMs,
        model: options.model,
        client: options.aiClient,
      });

      if (aiResult.partialMode) {
        overallPartialMode = true;
        partialModeReason = aiResult.reason || 'AI_UNAVAILABLE';
      }

      if (Array.isArray(aiResult.findings)) {
        allAiFindings.push(...aiResult.findings);
      }
    }
  }

  // --------------------------------------------------------------------------
  // STEP 5: Merge, Deduplicate, and Normalize Findings
  // --------------------------------------------------------------------------
  const mergedIssues = mergeAndDeduplicate(allStaticFindings, allAiFindings, {
    filePath: candidateFiles.length === 1 ? candidateFiles[0].path : 'repository',
  });

  // --------------------------------------------------------------------------
  // STEP 6: Compute Explainable Health Score and Category Metrics
  // --------------------------------------------------------------------------
  const totalLines = candidateFiles.reduce((acc, f) => acc + (f.lines || 0), 0);
  const hasSyntaxError = mergedIssues.some(
    (issue) => issue.ruleId === 'PARSER_ERROR' || issue.category === 'SYNTAX'
  );

  const scoreResult = calculateScore(mergedIssues, totalLines, candidateFiles.length, {
    hasSyntaxError,
  });

  // --------------------------------------------------------------------------
  // STEP 7: Return Canonical Review Results Payload
  // --------------------------------------------------------------------------
  const reviewId = crypto.randomUUID();

  // File level summaries
  const fileSummaries = candidateFiles.map((f) => {
    const fileIssues = mergedIssues.filter((i) => i.file === f.path);
    return {
      path: f.path,
      file_path: f.path,
      language: f.language,
      linesCount: f.lines || 0,
      issuesCount: fileIssues.length,
    };
  });

  // Issue severity counters
  const criticalCount = mergedIssues.filter((i) => i.severity === 'CRITICAL').length;
  const highCount = mergedIssues.filter((i) => i.severity === 'HIGH').length;
  const mediumCount = mergedIssues.filter((i) => i.severity === 'MEDIUM').length;
  const lowCount = mergedIssues.filter((i) => i.severity === 'LOW').length;
  const infoCount = mergedIssues.filter((i) => i.severity === 'INFO').length;

  // Warning banner configuration
  let warningBanner = null;
  if (hasSyntaxError) {
    warningBanner = {
      level: 'HIGH',
      severity: 'HIGH',
      title: 'Syntax Parsing Error Detected',
      message:
        'One or more source files contain syntax errors. Fix parsing errors to enable full AI semantic and AST analysis.',
    };
  } else if (overallPartialMode) {
    warningBanner = {
      level: 'INFO',
      severity: 'INFO',
      title: 'Partial Analysis Mode Active',
      message:
        'AI diagnostic engine was unavailable or timed out. Deterministic static AST security analysis was performed.',
    };
  }

  const canonicalPayload = {
    id: reviewId,
    projectName: effectiveProjectName,
    sourceType: effectiveSourceType,
    repoUrl: effectiveSourceType === 'github' ? targetUrl : null,
    status: 'COMPLETED',
    healthScore: scoreResult.healthScore,
    health_score: scoreResult.healthScore,
    grade: scoreResult.grade,
    summary: scoreResult.summary,
    categoryScores: scoreResult.categoryScores,
    partialMode: overallPartialMode,
    partialModeReason,
    warningBanner,
    metrics: {
      totalFiles: candidateFiles.length,
      totalLines,
      issuesCount: mergedIssues.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      infoCount,
    },
    files: fileSummaries,
    issues: mergedIssues,
    breakdown: scoreResult.breakdown,
    createdAt: new Date().toISOString(),
  };

  // Asynchronous persistence to Supabase via reviewRepository
  if (options.persist !== false) {
    try {
      await saveReviewResult({
        id: reviewId,
        userId: effectiveUserId,
        guestSessionId: effectiveGuestSessionId,
        projectName: effectiveProjectName,
        sourceType: effectiveSourceType,
        repoUrl: effectiveSourceType === 'github' ? targetUrl : null,
        healthScore: scoreResult.healthScore,
        grade: scoreResult.grade,
        status: 'completed',
        summary: scoreResult.summary,
        partialMode: overallPartialMode,
        files: fileSummaries,
        issues: mergedIssues,
      });
    } catch (persistErr) {
      console.warn('[Orchestrator] Persistence deferred or skipped:', persistErr.message);
    }
  }

  return canonicalPayload;
}

module.exports = {
  executeReviewPipeline,
  getExtensionForLanguage,
};
