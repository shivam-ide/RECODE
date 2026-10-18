/**
 * Re:Code — Findings Normalizer & Deduplication Engine
 *
 * Merges deterministic static AST analysis findings with generative Gemini AI diagnostic findings:
 * - Detects overlaps based on file identity, line proximity (+/- 2 lines), and category/rule semantics.
 * - Retains precise AST line numbers while adopting Gemini's plain-language explanations and diff patches (marked as 'HYBRID').
 * - Preserves independent AST static findings (marked as 'STATIC').
 * - Preserves independent AI architectural/optimization findings (marked as 'GEMINI').
 * - Sorts final output strictly: CRITICAL -> HIGH -> MEDIUM -> LOW -> INFO.
 */

const { generateStaticRemediationDiff } = require('./staticAnalyzer');

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

const SEVERITY_WEIGHTS = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
  INFO: 5,
};

const VALID_CATEGORIES = ['SYNTAX', 'SECURITY', 'QUALITY', 'OPTIMIZATION'];

/**
 * Truncate long code snippet lines exceeding maxLen to first truncLen characters + '...'
 * Prevents minified files and bundler outputs from overwhelming audit reports
 *
 * @param {string} str - Raw line or multi-line code snippet
 * @param {number} [maxLen=150] - Threshold length
 * @param {number} [truncLen=120] - Truncated length
 * @returns {string} Truncated string
 */
function truncateSnippetLine(str, maxLen = 120, truncLen = 117) {
  if (!str || typeof str !== 'string') return '';
  return str
    .split('\n')
    .map((line) => (line.length > maxLen ? line.slice(0, truncLen) + '...' : line))
    .join('\n');
}

/**
 * Normalize and compare file paths across OS formats (Windows backslashes vs POSIX)
 *
 * @param {string} fileA
 * @param {string} fileB
 * @returns {boolean} True if paths refer to the same file
 */
function isSameFile(fileA, fileB) {
  if (!fileA && !fileB) return true;
  if (!fileA || !fileB) return false;

  const normA = String(fileA).replace(/\\/g, '/').toLowerCase().trim();
  const normB = String(fileB).replace(/\\/g, '/').toLowerCase().trim();

  if (normA === normB) return true;
  if (normA === 'snippet' && normB === 'snippet') return true;

  // Partial path matches (e.g. 'userRepo.js' and 'src/repo/userRepo.js')
  if (normA.endsWith('/' + normB) || normB.endsWith('/' + normA)) return true;

  return false;
}

/**
 * Determine if a static finding and an AI finding address the same rule or category
 *
 * @param {Object} staticItem
 * @param {Object} aiItem
 * @returns {boolean}
 */
function isMatchingRuleOrCategory(staticItem, aiItem) {
  const staticCat = (staticItem.category || '').toUpperCase().trim();
  const aiCat = (aiItem.category || '').toUpperCase().trim();

  // 1. Direct identical category match (e.g. SECURITY == SECURITY, QUALITY == QUALITY)
  if (staticCat && aiCat && staticCat === aiCat) {
    return true;
  }

  // 2. Semantic rule correlation
  const staticRule = (staticItem.ruleId || '').toUpperCase().trim();
  const aiTitle = (aiItem.title || '').toUpperCase().trim();
  const aiExplanation = (aiItem.explanation || aiItem.description || '').toUpperCase().trim();

  if (staticRule === 'SQL_INJECTION' && (aiTitle.includes('SQL') || aiExplanation.includes('SQL'))) {
    return true;
  }

  if (
    staticRule === 'HARDCODED_SECRET' &&
    (aiTitle.includes('SECRET') ||
      aiTitle.includes('TOKEN') ||
      aiTitle.includes('KEY') ||
      aiTitle.includes('CREDENTIAL') ||
      aiExplanation.includes('SECRET') ||
      aiExplanation.includes('TOKEN') ||
      aiExplanation.includes('API KEY'))
  ) {
    return true;
  }

  if (
    staticRule === 'EMPTY_CATCH_BLOCK' &&
    (aiTitle.includes('CATCH') ||
      aiTitle.includes('EXCEPTION') ||
      aiExplanation.includes('CATCH') ||
      aiExplanation.includes('EXCEPTION'))
  ) {
    return true;
  }

  if (
    staticRule === 'UNUSED_VARIABLE' &&
    (aiTitle.includes('UNUSED') || aiExplanation.includes('UNUSED') || aiExplanation.includes('DECLARED'))
  ) {
    return true;
  }

  if (
    staticRule === 'CONSOLE_LOG_STMT' &&
    (aiTitle.includes('CONSOLE') ||
      aiTitle.includes('LOG') ||
      aiExplanation.includes('CONSOLE.LOG') ||
      aiExplanation.includes('LOGGER'))
  ) {
    return true;
  }

  return false;
}

/**
 * Resolve higher priority severity between two items
 *
 * @param {string} severityA
 * @param {string} severityB
 * @returns {string} The more critical severity
 */
function resolveSeverity(severityA, severityB) {
  const rawA = (severityA || '').toUpperCase().trim();
  const rawB = (severityB || '').toUpperCase().trim();

  const weightA = SEVERITY_WEIGHTS[rawA] || 99;
  const weightB = SEVERITY_WEIGHTS[rawB] || 99;

  return weightA <= weightB ? (SEVERITY_WEIGHTS[rawA] ? rawA : 'MEDIUM') : rawB;
}

/**
 * Sort findings by severity: CRITICAL -> HIGH -> MEDIUM -> LOW -> INFO
 * Secondary sort: file path -> line number ascending
 *
 * @param {Array<Object>} findings
 * @returns {Array<Object>} Sorted findings array
 */
function sortFindingsBySeverity(findings) {
  if (!Array.isArray(findings)) return [];

  return [...findings].sort((a, b) => {
    const weightA = SEVERITY_WEIGHTS[(a.severity || '').toUpperCase()] || 99;
    const weightB = SEVERITY_WEIGHTS[(b.severity || '').toUpperCase()] || 99;

    if (weightA !== weightB) {
      return weightA - weightB;
    }

    const fileA = (a.file || '').toLowerCase();
    const fileB = (b.file || '').toLowerCase();
    if (fileA !== fileB) {
      return fileA.localeCompare(fileB);
    }

    return (a.line || 0) - (b.line || 0);
  });
}

/**
 * Enrich finding with structured plain language explanation (What, Why, How) and explicit scope
 *
 * @param {Object} item
 * @returns {Object} Enriched finding item
 */
function enrichFindingDetails(item) {
  const rule = String(item.ruleId || item.category || '').toUpperCase();
  const line = item.line || item.lineNumber || 1;
  const fileName = item.file || 'source.js';

  let what = item.what || item.explanation || item.description || '';
  let why = item.why || '';
  let how = item.how || item.remediation || '';

  // Reset how if it duplicates what, description, or title
  if (
    !how ||
    how === what ||
    how === item.description ||
    how === item.explanation ||
    how === item.title
  ) {
    how = '';
  }

  if (rule.includes('SQL')) {
    what = what || 'User input is concatenated directly into a raw database SQL string instead of being passed as a parameterized placeholder.';
    why = why || 'Attackers can manipulate the query structure to bypass authentication, exfiltrate sensitive database records, or drop tables (CWE-89 SQL Injection).';
    how = how || 'Step 1: Never concatenate user inputs (`req.query.id`) directly into SQL query strings.\nStep 2: Use parameterized queries with placeholders (`$1, $2`).\nStep 3: Pass inputs safely via the query parameters array: `db.query(sqlQuery, [studentId, minGpa])`.';
  } else if (rule.includes('SECRET') || rule.includes('KEY') || rule.includes('CREDENTIAL') || rule.includes('CWE-798')) {
    what = what || 'A private credential, API secret, or JWT token is hardcoded in plaintext within the source code.';
    why = why || 'Hardcoded secrets committed to version control can be extracted by unauthorized users, compromising infrastructure and data (CWE-798).';
    how = how || 'Step 1: Install dotenv (`npm install dotenv`).\nStep 2: Create a root `.env` file and define `JWT_SECRET=your_secure_random_key`.\nStep 3: Replace the hardcoded string with `process.env.JWT_SECRET`.';
  } else if (rule.includes('UNUSED')) {
    what = what || 'A variable is declared in memory but is never referenced or read anywhere in the code scope.';
    why = why || 'Dead code increases developer confusion, creates potential memory leaks, and may indicate incomplete business logic (CWE-563).';
    how = how || 'Step 1: If this variable is unnecessary, delete line declaration.\nStep 2: If you intended to use it later in the file, reference it in your logic or export it.';
  } else if (rule.includes('CONSOLE') || rule.includes('LOG')) {
    what = what || 'A direct console.log() debugging statement is active in an application execution path.';
    why = why || 'Console logging can leak private user information or tokens to stdout and degrades asynchronous I/O performance under load (CWE-532).';
    how = how || 'Step 1: Remove debug statements before merging into production.\nStep 2: Use an enterprise logger (such as Winston or Pino) if runtime logging is required.';
  } else if (rule.includes('CATCH')) {
    what = what || 'An empty catch block is silently swallowing errors without logging or handling them.';
    why = why || 'Silencing exceptions hides runtime failures, leaves application state corrupted, and makes production issues impossible to trace (CWE-390).';
    how = how || 'Step 1: Log the caught error with `logger.error(err.message)`.\nStep 2: Either handle the failure gracefully or re-throw the exception.';
  } else if (rule.includes('PARSER') || rule.includes('SYNTAX')) {
    what = what || `Syntax error on line ${line}: Unexpected or missing compiler token.`;
    why = why || 'The JavaScript/programming engine cannot parse the file, causing immediate runtime crashes on initialization.';
    how = how || `Step 1: Inspect line ${line} for unclosed brackets, missing semicolons, or mismatched parentheses.\nStep 2: Add the required delimiter or closing token to properly terminate the block.`;
  } else {
    what = what || item.title || 'Code quality or security defect detected.';
    why = why || 'Unresolved code issues increase vulnerability risk, degrade runtime performance, and add technical debt.';
    how = how || item.remediation || 'Step 1: Review the affected code logic against secure development best practices.\nStep 2: Apply the recommended remediation diff patch below.';
  }

  // Ensure what and how are NEVER identical
  if (how === what || !how) {
    how = 'Step 1: Review the affected code logic against secure development best practices.\nStep 2: Apply the recommended remediation diff patch below.';
  }

  // Explicit engine label assignment
  const sourceUpper = String(item.source || item.engine_source || item.engine || '').toUpperCase();
  if (sourceUpper.includes('HYBRID')) {
    item.engine = 'HYBRID (AST + AI)';
    item.engine_source = 'HYBRID';
    item.source = 'HYBRID';
  } else if (sourceUpper.includes('GEMINI') || sourceUpper.includes('AI')) {
    item.engine = 'Gemini AI';
    item.engine_source = 'GEMINI';
    item.source = 'GEMINI';
  } else {
    item.engine = 'Static AST';
    item.engine_source = 'STATIC';
    item.source = 'STATIC';
  }

  item.what = what;
  item.what_is_wrong = what;
  item.why = why;
  item.why_dangerous = why;
  item.how = how;
  item.how_to_fix = how;
  item.remediation = how;
  item.line = line;
  item.line_number = line;
  item.lineNumber = line;
  item.scope = `Line ${line} in ${fileName}`;
  return item;
}

/**
 * Merge and deduplicate Static AST and Gemini AI findings
 *
 * @param {Array<Object>} [staticFindings=[]] - Output from static AST analyzer
 * @param {Array<Object>} [aiFindings=[]] - Output from Gemini AI reviewer
 * @param {Object} [fileMetadata={}] - Optional file context (filePath, linesCount, language)
 * @returns {Array<Object>} Merged, deduplicated, and severity-sorted findings
 */
function mergeAndDeduplicate(staticFindings = [], aiFindings = [], fileMetadata = {}) {
  const safeStatic = Array.isArray(staticFindings) ? staticFindings : [];
  const rawAi = Array.isArray(aiFindings) ? aiFindings : [];

  const defaultFile = fileMetadata.filePath || fileMetadata.file || 'snippet';

  // 0. Pre-deduplicate incoming AI findings
  const seenAiKey = new Set();
  const safeAi = [];
  for (const aItem of rawAi) {
    if (!aItem || typeof aItem !== 'object') continue;
    const aLine = typeof aItem.line === 'number' ? aItem.line : aItem.lineNumber || 1;
    const aFile = aItem.file || defaultFile;
    const normFile = String(aFile).replace(/\\/g, '/').toLowerCase();
    const aCat = String(aItem.category || 'QUALITY').toUpperCase();
    const aTitle = String(aItem.title || '').trim().toLowerCase();
    const key = `${normFile}:${aLine}:${aCat}:${aTitle}`;
    if (!seenAiKey.has(key)) {
      seenAiKey.add(key);
      safeAi.push(aItem);
    }
  }

  const merged = [];
  const matchedStaticIndices = new Set();
  const matchedAiIndices = new Set();

  // 1. Identify overlapping pairs: same file, line proximity (+/- 2 lines), identical rule/category
  for (let sIdx = 0; sIdx < safeStatic.length; sIdx++) {
    const sItem = safeStatic[sIdx];
    const sLine = typeof sItem.line === 'number' ? sItem.line : sItem.lineNumber || 1;
    const sFile = sItem.file || defaultFile;

    // PARSER_ERROR is always an independent static finding
    if (sItem.ruleId === 'PARSER_ERROR' || sItem.category === 'SYNTAX') {
      continue;
    }

    let bestAiMatchIdx = -1;
    let minLineDelta = Infinity;

    for (let aIdx = 0; aIdx < safeAi.length; aIdx++) {
      if (matchedAiIndices.has(aIdx)) continue;

      const aItem = safeAi[aIdx];
      const aLine = typeof aItem.line === 'number' ? aItem.line : aItem.lineNumber || 1;
      const aFile = aItem.file || defaultFile;

      if (!isSameFile(sFile, aFile)) {
        continue;
      }

      const lineDelta = Math.abs(sLine - aLine);
      if (lineDelta <= 2 && isMatchingRuleOrCategory(sItem, aItem)) {
        if (lineDelta < minLineDelta) {
          minLineDelta = lineDelta;
          bestAiMatchIdx = aIdx;
        }
      }
    }

    if (bestAiMatchIdx !== -1) {
      matchedStaticIndices.add(sIdx);
      matchedAiIndices.add(bestAiMatchIdx);

      // Also consume any duplicate AI items for this same rule/line
      for (let aIdx = 0; aIdx < safeAi.length; aIdx++) {
        if (matchedAiIndices.has(aIdx)) continue;
        const otherAi = safeAi[aIdx];
        const otherLine = typeof otherAi.line === 'number' ? otherAi.line : otherAi.lineNumber || 1;
        const otherFile = otherAi.file || defaultFile;
        if (
          isSameFile(sFile, otherFile) &&
          Math.abs(sLine - otherLine) <= 2 &&
          isMatchingRuleOrCategory(sItem, otherAi)
        ) {
          matchedAiIndices.add(aIdx);
        }
      }

      const aItem = safeAi[bestAiMatchIdx];
      const targetFile = sFile || aItem.file || defaultFile;
      const resolvedSev = resolveSeverity(sItem.severity, aItem.severity);

      const rawDiffBefore = aItem.diff_before || sItem.diff_before || sItem.evidence || '';
      const effectiveDiffBefore = truncateSnippetLine(rawDiffBefore);
      let effectiveDiffAfter = aItem.diff_after || sItem.diff_after || '';
      if (!effectiveDiffAfter) {
        effectiveDiffAfter = generateStaticRemediationDiff(sItem.ruleId, effectiveDiffBefore);
      }
      effectiveDiffAfter = truncateSnippetLine(effectiveDiffAfter);

      // HYBRID finding: retain AST precise line number, adopt Gemini's explanation and diff patch
      merged.push({
        file: targetFile,
        line: sLine,
        lineNumber: sLine,
        severity: resolvedSev,
        category: sItem.category || aItem.category || 'QUALITY',
        ruleId: sItem.ruleId || 'HYBRID_FINDING',
        title: aItem.title || sItem.title || 'Code Finding',
        description: aItem.explanation || aItem.description || sItem.description || '',
        explanation: aItem.explanation || aItem.description || sItem.description || '',
        remediation: aItem.explanation || aItem.remediation || sItem.description || '',
        diff_before: effectiveDiffBefore,
        diff_after: effectiveDiffAfter,
        evidence: truncateSnippetLine(sItem.evidence || aItem.diff_before || ''),
        source: 'HYBRID',
        engine_source: 'HYBRID',
        engine: 'HYBRID (AST + AI)',
      });
    }
  }

  // 2. Preserve independent static findings (e.g. PARSER_ERROR or unmatched AST findings)
  for (let sIdx = 0; sIdx < safeStatic.length; sIdx++) {
    if (matchedStaticIndices.has(sIdx)) continue;

    const sItem = safeStatic[sIdx];
    const sLine = typeof sItem.line === 'number' ? sItem.line : sItem.lineNumber || 1;
    const targetFile = sItem.file || defaultFile;

    const rawDiffBefore = sItem.diff_before || sItem.evidence || '';
    const effectiveDiffBefore = truncateSnippetLine(rawDiffBefore);
    let effectiveDiffAfter = sItem.diff_after || '';
    if (!effectiveDiffAfter) {
      effectiveDiffAfter = generateStaticRemediationDiff(sItem.ruleId, effectiveDiffBefore);
    }
    effectiveDiffAfter = truncateSnippetLine(effectiveDiffAfter);

    merged.push({
      file: targetFile,
      line: sLine,
      lineNumber: sLine,
      severity: sItem.severity || 'MEDIUM',
      category: sItem.category || 'QUALITY',
      ruleId: sItem.ruleId || 'STATIC_FINDING',
      title: sItem.title || 'Static Analysis Finding',
      description: sItem.description || sItem.title || '',
      explanation: sItem.description || sItem.title || '',
      remediation: sItem.remediation || sItem.description || '',
      diff_before: effectiveDiffBefore,
      diff_after: effectiveDiffAfter,
      evidence: truncateSnippetLine(sItem.evidence || ''),
      source: 'STATIC',
      engine_source: 'STATIC',
      engine: 'Static AST',
    });
  }

  // 3. Preserve independent AI findings (e.g. architectural flaws, O(N^2) bottlenecks, logic issues)
  for (let aIdx = 0; aIdx < safeAi.length; aIdx++) {
    if (matchedAiIndices.has(aIdx)) continue;

    const aItem = safeAi[aIdx];
    const aLine = typeof aItem.line === 'number' ? aItem.line : aItem.lineNumber || 1;
    const targetFile = aItem.file || defaultFile;

    const rawDiffBefore = aItem.diff_before || '';
    const effectiveDiffBefore = truncateSnippetLine(rawDiffBefore);
    let effectiveDiffAfter = aItem.diff_after || '';
    if (
      effectiveDiffAfter &&
      effectiveDiffAfter.includes('SELECT * FROM students') &&
      !String(aItem.title || '').toLowerCase().includes('sql') &&
      !String(aItem.ruleId || '').toUpperCase().includes('SQL')
    ) {
      effectiveDiffAfter = generateStaticRemediationDiff(aItem.ruleId || aItem.category, effectiveDiffBefore);
    }
    if (!effectiveDiffAfter) {
      effectiveDiffAfter = generateStaticRemediationDiff(aItem.ruleId || aItem.category, effectiveDiffBefore);
    }
    effectiveDiffAfter = truncateSnippetLine(effectiveDiffAfter);

    merged.push({
      file: targetFile,
      line: aLine,
      lineNumber: aLine,
      severity: aItem.severity || 'MEDIUM',
      category: aItem.category || 'QUALITY',
      ruleId: aItem.ruleId || `AI_${(aItem.category || 'FINDING').toUpperCase()}`,
      title: aItem.title || 'AI Review Finding',
      description: aItem.explanation || aItem.description || aItem.title || '',
      explanation: aItem.explanation || aItem.description || aItem.title || '',
      remediation: aItem.explanation || aItem.remediation || '',
      diff_before: effectiveDiffBefore,
      diff_after: effectiveDiffAfter,
      evidence: truncateSnippetLine(aItem.diff_before || ''),
      source: 'GEMINI',
      engine_source: 'GEMINI',
      engine: 'Gemini AI',
    });
  }

  // 4. Strict line-level deduplication: merge competing findings on the same line
  const lineGroups = new Map();
  for (const item of merged) {
    const normFile = String(item.file || defaultFile).replace(/\\/g, '/').toLowerCase();
    const line = item.line || 1;
    const groupKey = `${normFile}:${line}`;
    if (!lineGroups.has(groupKey)) {
      lineGroups.set(groupKey, []);
    }
    lineGroups.get(groupKey).push(item);
  }

  const resolved = [];
  for (const [, items] of lineGroups.entries()) {
    if (items.length === 1) {
      resolved.push(enrichFindingDetails(items[0]));
      continue;
    }

    const secretItem = items.find(
      (i) => (i.ruleId || '').includes('SECRET') || (i.title || '').toLowerCase().includes('secret')
    );
    const unusedItem = items.find(
      (i) => (i.ruleId || '').includes('UNUSED') || (i.title || '').toLowerCase().includes('unused')
    );
    const sqlItem = items.find(
      (i) => (i.ruleId || '').includes('SQL') || (i.title || '').toLowerCase().includes('sql')
    );

    if (secretItem && unusedItem) {
      // Merge into a single CRITICAL card as requested:
      // "Hardcoded Secret (Variable is also unused). Do not commit secrets in source code."
      secretItem.title = 'Hardcoded Secret (Variable is also unused)';
      secretItem.severity = 'CRITICAL';
      secretItem.what = 'Hardcoded Secret (Variable is also unused). Do not commit secrets in source code.';
      secretItem.description = 'Hardcoded Secret (Variable is also unused). Do not commit secrets in source code.';
      secretItem.explanation = 'Hardcoded Secret (Variable is also unused). Do not commit secrets in source code.';
      secretItem.why = 'Hardcoded secrets committed to version control can be extracted by unauthorized users, compromising infrastructure and data (CWE-798).';
      secretItem.how = 'Step 1: Install dotenv (`npm install dotenv`).\nStep 2: Create a root `.env` file and define `JWT_SECRET=your_secure_random_key`.\nStep 3: Replace the hardcoded string with `process.env.JWT_SECRET`.';
      secretItem.how_to_fix = secretItem.how;
      if (
        unusedItem.source === 'HYBRID' ||
        secretItem.source === 'HYBRID' ||
        unusedItem.engine_source === 'HYBRID' ||
        secretItem.engine_source === 'HYBRID' ||
        (unusedItem.source === 'GEMINI' && secretItem.source === 'STATIC') ||
        (unusedItem.source === 'STATIC' && secretItem.source === 'GEMINI')
      ) {
        secretItem.source = 'HYBRID';
        secretItem.engine_source = 'HYBRID';
        secretItem.engine = 'HYBRID (AST + AI)';
      }
      resolved.push(enrichFindingDetails(secretItem));
      continue;
    }

    if (sqlItem && unusedItem) {
      sqlItem.title = 'SQL Injection Vulnerability (Query variable is also unused)';
      sqlItem.severity = 'CRITICAL';
      sqlItem.description = `${sqlItem.description} (Note: This query variable is also declared but unused).`;
      if (
        unusedItem.source === 'HYBRID' ||
        sqlItem.source === 'HYBRID' ||
        unusedItem.engine_source === 'HYBRID' ||
        sqlItem.engine_source === 'HYBRID' ||
        (unusedItem.source === 'GEMINI' && sqlItem.source === 'STATIC') ||
        (unusedItem.source === 'STATIC' && sqlItem.source === 'GEMINI')
      ) {
        sqlItem.source = 'HYBRID';
        sqlItem.engine_source = 'HYBRID';
        sqlItem.engine = 'HYBRID (AST + AI)';
      }
      resolved.push(enrichFindingDetails(sqlItem));
      continue;
    }

    // General deduplication on same line: sort by severity, keep highest, merge engine info
    items.sort((a, b) => (SEVERITY_WEIGHTS[a.severity] || 99) - (SEVERITY_WEIGHTS[b.severity] || 99));
    const primary = items[0];
    const secondary = items.slice(1);
    if (primary.ruleId === 'PARSER_ERROR' || primary.category === 'SYNTAX') {
      primary.source = 'STATIC';
      primary.engine_source = 'STATIC';
      primary.engine = 'Static AST';
    } else if (
      primary.source === 'HYBRID' ||
      primary.engine_source === 'HYBRID' ||
      secondary.some((s) => s.source === 'HYBRID' || s.engine_source === 'HYBRID') ||
      (primary.source === 'STATIC' && secondary.some((s) => s.source === 'GEMINI')) ||
      (primary.source === 'GEMINI' && secondary.some((s) => s.source === 'STATIC'))
    ) {
      primary.source = 'HYBRID';
      primary.engine_source = 'HYBRID';
      primary.engine = 'HYBRID (AST + AI)';
    }
    resolved.push(enrichFindingDetails(primary));
  }

  // 5. Sort final output: CRITICAL -> HIGH -> MEDIUM -> LOW -> INFO
  return sortFindingsBySeverity(resolved);
}

module.exports = {
  SEVERITY_ORDER,
  SEVERITY_WEIGHTS,
  VALID_CATEGORIES,
  isSameFile,
  isMatchingRuleOrCategory,
  resolveSeverity,
  sortFindingsBySeverity,
  mergeAndDeduplicate,
};
