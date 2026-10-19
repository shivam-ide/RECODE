const crypto = require('crypto');
const { validateDirectSnippet, validateGitHubUrl } = require('../utils/validators');
const { resolveDnsAndValidate } = require('../middleware/security');
const { ingestRepository } = require('./ingestion/githubIngestion');
const { analyzeFile, validateSyntaxGuard } = require('./analysis/staticAnalyzer');
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
    case 'sql':
      return 'sql';
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
  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // STEP 3: Stage 1 (Syntax Guard) & Stage 2 (Static Deterministic Rules)
  // --------------------------------------------------------------------------
  const allStaticFindings = [];
  const fileStaticMap = new Map();
  const fileSyntaxStatusMap = new Map();

  for (const file of candidateFiles) {
    let fileFindings = [];
    let fileHasSyntaxError = false;

    try {
      // Stage 1: Validate syntax against designated language
      const syntaxResult = validateSyntaxGuard(file.path, file.content, file.language);
      if (!syntaxResult.isValid) {
        // Output precise syntax diagnostics and HALT further false vulnerability alerts
        fileHasSyntaxError = true;
        fileFindings = syntaxResult.syntaxFindings;
      } else {
        // Stage 2: Run deterministic static AST & regex analysis
        fileFindings = analyzeFile(file.path, file.content, file.language);
        if (fileFindings.some((f) => f.ruleId === 'PARSER_ERROR' || f.category === 'SYNTAX')) {
          fileHasSyntaxError = true;
        }
      }
    } catch (analysisErr) {
      console.warn(`[Orchestrator] Static analysis failed for ${file.path}:`, analysisErr.message);
      fileHasSyntaxError = true;
      fileFindings = [
        {
          file: file.path,
          line: 1,
          column: 1,
          lineNumber: 1,
          severity: 'HIGH',
          category: 'SYNTAX',
          ruleId: 'PARSER_ERROR',
          title: 'Syntax Parsing Guard Failure',
          description: `Source file could not be parsed: ${analysisErr.message}`,
          remediation: 'Review file for fatal syntax defects or unclosed constructs.',
          evidence: (file.content.split(/\r\n|\r|\n/)[0] || '').trim(),
          diff_before: (file.content.split(/\r\n|\r|\n/)[0] || '').trim(),
          diff_after: '// Fix syntax error',
          source: 'STATIC',
          engine_source: 'STATIC',
          engine: 'Static AST',
        },
      ];
    }

    fileStaticMap.set(file.path, fileFindings);
    fileSyntaxStatusMap.set(file.path, fileHasSyntaxError);
    allStaticFindings.push(...fileFindings);
  }

  // --------------------------------------------------------------------------
  // STEP 4: Stage 3 (Structured LLM Review with Grounding)
  // --------------------------------------------------------------------------
  const runAiEngine = async () => {
    const aiFindings = [];
    let partialMode = false;
    let reason = null;

    if (options.skipAi) {
      return { partialMode: true, reason: 'SKIPPED_BY_OPTIONS', findings: [] };
    }

    const aiTargetFiles = candidateFiles.slice(0, 15);
    const aiBatchSize = 3;
    let aiSuccessCount = 0;

    for (let i = 0; i < aiTargetFiles.length; i += aiBatchSize) {
      const batch = aiTargetFiles.slice(i, i + aiBatchSize);
      const batchPromises = batch.map(async (file) => {
        const fileHasSyntaxError = fileSyntaxStatusMap.get(file.path) || false;

        // Stage 1 Guard: If syntax fails, halt further false vulnerability alerts
        // Do NOT run AI scan on broken syntax!
        if (fileHasSyntaxError) {
          return { partialMode: false, findings: [] };
        }

        try {
          const fileStaticFindings = fileStaticMap.get(file.path) || [];
          return await reviewCodeWithGemini({
            filePath: file.path,
            codeContent: file.content,
            language: file.language,
            staticFindings: fileStaticFindings,
            hasSyntaxError: false,
            timeoutMs: options.timeoutMs,
            model: options.model,
            client: options.aiClient,
          });
        } catch (aiErr) {
          console.warn(`[Orchestrator] AI review error for ${file.path}:`, aiErr.message);
          return { partialMode: true, reason: 'AI_CALL_FAILED', findings: [] };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      for (const aiResult of batchResults) {
        if (!aiResult.partialMode) {
          aiSuccessCount++;
        } else {
          reason = aiResult.reason || 'AI_UNAVAILABLE';
        }
        if (Array.isArray(aiResult.findings)) {
          aiFindings.push(...aiResult.findings);
        }
      }

      // Throttle pause between batches
      if (i + aiBatchSize < aiTargetFiles.length) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    const allSyntaxBroken = candidateFiles.every((f) => fileSyntaxStatusMap.get(f.path));
    partialMode = !allSyntaxBroken && aiSuccessCount === 0 && candidateFiles.length > 0;
    return { partialMode, reason, findings: aiFindings };
  };

  const aiExecution = await runAiEngine();

  const allAiFindings = aiExecution.findings || [];
  const overallPartialMode = aiExecution.partialMode || false;
  const partialModeReason = aiExecution.reason || null;

  // --------------------------------------------------------------------------
  // STEP 5: Deduplication & Cross-Validation
  // --------------------------------------------------------------------------
  let mergedIssues = [];
  try {
    mergedIssues = mergeAndDeduplicate(allStaticFindings, allAiFindings, {
      filePath: candidateFiles.length === 1 ? candidateFiles[0].path : 'repository',
      content: candidateFiles.length === 1 ? candidateFiles[0].content : '',
    });
  } catch (dedupeErr) {
    console.warn('[Orchestrator] Findings reconciliation error, falling back to static findings:', dedupeErr.message);
    mergedIssues = allStaticFindings;
  }

  // --------------------------------------------------------------------------
  // STEP 6: Compute Explainable Health Score and Category Metrics
  // --------------------------------------------------------------------------
  const totalLines = candidateFiles.reduce((acc, f) => acc + (f.lines || 0), 0);
  const hasSyntaxError = mergedIssues.some(
    (issue) => issue.ruleId === 'PARSER_ERROR' || issue.category === 'SYNTAX'
  );

  let scoreResult;
  try {
    scoreResult = calculateScore(mergedIssues, totalLines, candidateFiles.length, {
      hasSyntaxError,
    });
  } catch (scoreErr) {
    console.warn('[Orchestrator] Score calculation error, using safe fallback:', scoreErr.message);
    scoreResult = {
      healthScore: hasSyntaxError ? 70 : 85,
      grade: hasSyntaxError ? 'C' : 'B',
      summary: 'Analysis completed with fallback evaluation.',
      categoryScores: {
        bugsHealth: hasSyntaxError ? 70 : 90,
        securityHealth: 90,
        qualityHealth: 90,
        optimizationHealth: 90,
      },
      breakdown: [],
    };
  }

  // --------------------------------------------------------------------------
  // STEP 7: Return Canonical Review Results Payload
  // --------------------------------------------------------------------------
  const reviewId = crypto.randomUUID();

  // File level summaries with source content for in-memory patching
  const fileSummaries = candidateFiles.map((f) => {
    const fileIssues = mergedIssues.filter((i) => i.file === f.path);
    return {
      path: f.path,
      file_path: f.path,
      language: f.language,
      linesCount: f.lines || 0,
      content: f.content || '',
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
    findings: mergedIssues,
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
