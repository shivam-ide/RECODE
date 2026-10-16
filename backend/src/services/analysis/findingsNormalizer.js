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
        diff_before: aItem.diff_before || sItem.evidence || '',
        diff_after: aItem.diff_after || '',
        evidence: sItem.evidence || aItem.diff_before || '',
        source: 'HYBRID',
        engine_source: 'HYBRID',
      });
    }
  }

  // 2. Preserve independent static findings (e.g. PARSER_ERROR or unmatched AST findings)
  for (let sIdx = 0; sIdx < safeStatic.length; sIdx++) {
    if (matchedStaticIndices.has(sIdx)) continue;

    const sItem = safeStatic[sIdx];
    const sLine = typeof sItem.line === 'number' ? sItem.line : sItem.lineNumber || 1;
    const targetFile = sItem.file || defaultFile;

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
      diff_before: sItem.evidence || '',
      diff_after: sItem.diff_after || '',
      evidence: sItem.evidence || '',
      source: 'STATIC',
      engine_source: 'STATIC',
    });
  }

  // 3. Preserve independent AI findings (e.g. architectural flaws, O(N^2) bottlenecks, logic issues)
  for (let aIdx = 0; aIdx < safeAi.length; aIdx++) {
    if (matchedAiIndices.has(aIdx)) continue;

    const aItem = safeAi[aIdx];
    const aLine = typeof aItem.line === 'number' ? aItem.line : aItem.lineNumber || 1;
    const targetFile = aItem.file || defaultFile;

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
      diff_before: aItem.diff_before || '',
      diff_after: aItem.diff_after || '',
      evidence: aItem.diff_before || '',
      source: 'GEMINI',
      engine_source: 'GEMINI',
    });
  }

  // 4. Strict deduplication pass over merged items
  const finalSeen = new Set();
  const deduplicated = [];

  for (const item of merged) {
    const normFile = String(item.file || 'snippet').replace(/\\/g, '/').toLowerCase();
    const line = item.line || 1;
    const rule = item.ruleId || item.category || 'ISSUE';
    const title = String(item.title || '').trim().toLowerCase();
    const key = `${normFile}:${line}:${rule}:${title}`;

    if (finalSeen.has(key)) continue;
    finalSeen.add(key);
    deduplicated.push(item);
  }

  // 5. Sort final output: CRITICAL -> HIGH -> MEDIUM -> LOW -> INFO
  return sortFindingsBySeverity(deduplicated);
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
