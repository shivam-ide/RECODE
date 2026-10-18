/**
 * Re:Code — Health Scoring & Grading Engine
 *
 * Evaluates normalized code audit findings and calculates deterministic project health metrics:
 * - Weighted severity penalties:
 *   * CRITICAL: 20 pts each (urgent vulnerabilities)
 *   * HIGH: 10 pts each (architectural / logic flaws)
 *   * MEDIUM: 3 pts each, capped at 20 pts project total
 *   * LOW: 0.5 pts each, capped at 15 pts project total (prevents excessive minor notices like console.logs from failing audit)
 *   * INFO: 0 pts (advisory recommendations)
 * - Zero Critical & Zero High Guarantee: Codebases with 0 Critical and 0 High issues never drop below Grade C (min score 70).
 * - Syntax Failure Penalty: Code with unparsed syntax errors incurs 30 pts penalty and is capped at Grade C (score 70).
 * - Multi-dimensional category health percentages: bugsHealth, securityHealth, qualityHealth, optimizationHealth.
 * - Provides transparent deduction breakdown for frontend diagnostics.
 */

const PENALTY_WEIGHTS = {
  CRITICAL: 20,
  HIGH: 10,
  MEDIUM: 3,
  LOW: 0.5,
  INFO: 0,
};

const SEVERITY_CAPS = {
  LOW: 15,
  MEDIUM: 20,
  HIGH: 100,
  CRITICAL: 100,
};

const GRADE_THRESHOLDS = [
  { min: 97, grade: 'A+', label: 'Exceptional — Production Ready' },
  { min: 90, grade: 'A', label: 'Strong — Minor Refinements Recommended' },
  { min: 80, grade: 'B+', label: 'Good — Standard Code Quality' },
  { min: 70, grade: 'B', label: 'Acceptable — Moderate Code Smells' },
  { min: 60, grade: 'C', label: 'Needs Improvement — Architecture Concerns' },
  { min: 50, grade: 'D', label: 'Poor — High Risk Vulnerabilities Present' },
  { min: 0, grade: 'F', label: 'Failing — Critical Security or Syntax Defects' },
];

/**
 * Determine letter grade from numerical health score
 *
 * @param {number} score - Scaled health score (0 - 100)
 * @returns {string} Letter grade ('A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F')
 */
function getGrade(score) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  for (const tier of GRADE_THRESHOLDS) {
    if (clampedScore >= tier.min) {
      return tier.grade;
    }
  }
  return 'F';
}

/**
 * Generate human-readable summary based on score and issues breakdown
 */
function generateHealthSummary(score, grade, findingsCount, criticalCount) {
  if (score >= 97) {
    return `Grade ${grade} (${score}/100) — Pristine codebase. Zero high-impact vulnerabilities detected.`;
  }
  if (score >= 90) {
    return `Grade ${grade} (${score}/100) — Clean codebase with minor quality or style optimizations suggested.`;
  }
  if (score >= 80) {
    return `Grade ${grade} (${score}/100) — Good codebase integrity with moderate issues requiring standard remediation.`;
  }
  if (score >= 70) {
    return `Grade ${grade} (${score}/100) — Acceptable status, but notable security or architectural smells must be addressed.`;
  }
  if (score >= 60) {
    return `Grade ${grade} (${score}/100) — Substandard quality. Multiple high-severity issues affect system reliability.`;
  }
  if (score >= 50) {
    return `Grade ${grade} (${score}/100) — High risk. ${criticalCount > 0 ? `${criticalCount} CRITICAL vulnerabilities present. ` : ''}Remediation is urgent.`;
  }
  return `Grade ${grade} (${score}/100) — Failing audit. Severe syntax failures or critical vulnerabilities render codebase insecure for deployment.`;
}

/**
 * Calculate Comprehensive Health Score & Deduction Breakdown
 *
 * @param {Array<Object>|Object} findingsOrOptions - Normalized findings array or options object
 * @param {number} [totalLines=0] - Total lines of code in analyzed repository/snippet
 * @param {number} [filesCount=1] - Total candidate files evaluated
 * @param {Object} [options={}] - Additional flags (e.g. unparsedFiles, hasSyntaxError)
 * @returns {Object} Transparent score breakdown, letter grade, and category percentages
 */
function calculateScore(findingsOrOptions, totalLines = 0, filesCount = 1, options = {}) {
  let findings = [];
  let lines = typeof totalLines === 'number' && Number.isFinite(totalLines) ? Math.max(0, totalLines) : 0;
  let files = typeof filesCount === 'number' && Number.isFinite(filesCount) ? Math.max(1, filesCount) : 1;
  let opts = options || {};

  // Support object signature: calculateScore({ findings, totalLines, filesCount, ... })
  if (findingsOrOptions && !Array.isArray(findingsOrOptions) && typeof findingsOrOptions === 'object') {
    findings = Array.isArray(findingsOrOptions.findings) ? findingsOrOptions.findings : [];
    lines = typeof findingsOrOptions.totalLines === 'number' && Number.isFinite(findingsOrOptions.totalLines)
      ? Math.max(0, findingsOrOptions.totalLines)
      : lines;
    files = typeof findingsOrOptions.filesCount === 'number' && Number.isFinite(findingsOrOptions.filesCount)
      ? Math.max(1, findingsOrOptions.filesCount)
      : files;
    opts = findingsOrOptions.options || findingsOrOptions;
  } else if (Array.isArray(findingsOrOptions)) {
    findings = findingsOrOptions;
  }

  const severityCounts = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };

  const categoryCounts = {
    SYNTAX: 0,
    SECURITY: 0,
    QUALITY: 0,
    OPTIMIZATION: 0,
  };

  const categoryRawPenalties = {
    SYNTAX: 0,
    SECURITY: 0,
    QUALITY: 0,
    OPTIMIZATION: 0,
  };

  let hasSyntaxError = !!opts.hasSyntaxError || (typeof opts.unparsedFiles === 'number' && opts.unparsedFiles > 0);

  // 1. Process finding counts and raw category deductions
  for (const item of findings) {
    if (!item || typeof item !== 'object') continue;

    const rawSev = String(item.severity || 'MEDIUM').toUpperCase().trim();
    const severity = PENALTY_WEIGHTS[rawSev] !== undefined ? rawSev : 'MEDIUM';

    const rawCat = String(item.category || 'QUALITY').toUpperCase().trim();
    const category = categoryCounts[rawCat] !== undefined ? rawCat : 'QUALITY';

    if (item.ruleId === 'PARSER_ERROR' || category === 'SYNTAX') {
      hasSyntaxError = true;
    }

    const penalty = Number.isFinite(PENALTY_WEIGHTS[severity]) ? PENALTY_WEIGHTS[severity] : 0;

    severityCounts[severity]++;
    categoryCounts[category]++;
    categoryRawPenalties[category] += penalty;
  }

  // 2. Apply Capping per Severity Level
  // - CRITICAL: 20 pts each (uncapped up to 100)
  // - HIGH: 10 pts each (uncapped up to 100)
  // - MEDIUM: 3 pts each, capped at 20 pts
  // - LOW: 0.5 pts each, capped at 15 pts
  const rawCriticalDeduction = severityCounts.CRITICAL * PENALTY_WEIGHTS.CRITICAL;
  const rawHighDeduction = severityCounts.HIGH * PENALTY_WEIGHTS.HIGH;
  const rawMediumDeduction = severityCounts.MEDIUM * PENALTY_WEIGHTS.MEDIUM;
  const rawLowDeduction = severityCounts.LOW * PENALTY_WEIGHTS.LOW;

  const severityDeductions = {
    CRITICAL: rawCriticalDeduction,
    HIGH: rawHighDeduction,
    MEDIUM: Math.min(SEVERITY_CAPS.MEDIUM, rawMediumDeduction),
    LOW: Math.min(SEVERITY_CAPS.LOW, rawLowDeduction),
    INFO: 0,
  };

  let totalDeductions =
    severityDeductions.CRITICAL +
    severityDeductions.HIGH +
    severityDeductions.MEDIUM +
    severityDeductions.LOW;

  // Scale category deductions so sum aligns with total capped deductions
  const rawTotalPenalties = rawCriticalDeduction + rawHighDeduction + rawMediumDeduction + rawLowDeduction;
  const categoryDeductions = {
    SYNTAX: 0,
    SECURITY: 0,
    QUALITY: 0,
    OPTIMIZATION: 0,
  };

  if (rawTotalPenalties > 0 && totalDeductions > 0) {
    const scaleFactor = totalDeductions / rawTotalPenalties;
    categoryDeductions.SYNTAX = Math.round(categoryRawPenalties.SYNTAX * scaleFactor);
    categoryDeductions.SECURITY = Math.round(categoryRawPenalties.SECURITY * scaleFactor);
    categoryDeductions.QUALITY = Math.round(categoryRawPenalties.QUALITY * scaleFactor);
    categoryDeductions.OPTIMIZATION = Math.round(categoryRawPenalties.OPTIMIZATION * scaleFactor);
  }

  // 3. Syntax compilation failures: Deduct at least 30 points (and cap max score at 70 / Grade C)
  const SYNTAX_PENALTY = 30;
  if (hasSyntaxError) {
    if (categoryDeductions.SYNTAX < SYNTAX_PENALTY) {
      const extraDeduction = SYNTAX_PENALTY - categoryDeductions.SYNTAX;
      categoryDeductions.SYNTAX = SYNTAX_PENALTY;
      totalDeductions += extraDeduction;
    }
  }

  // 4. Compute final health score clamped strictly to [0, 100]
  let rawScore = Math.max(0, Math.min(100, Math.round(100 - totalDeductions)));

  // "A project with 0 Critical and 0 High issues MUST NEVER drop below Grade C (minimum score 70)."
  if (severityCounts.CRITICAL === 0 && severityCounts.HIGH === 0) {
    rawScore = Math.max(70, rawScore);
  }

  const finalScore = hasSyntaxError ? Math.min(70, rawScore) : rawScore;

  // 5. Grade resolution:
  // - Code with 0 Critical and 0 High issues cannot drop below Grade C
  // - Broken code with syntax error cannot be given Grade A, A+, B+, or B
  let grade = getGrade(finalScore);
  if (severityCounts.CRITICAL === 0 && severityCounts.HIGH === 0) {
    if (grade === 'D' || grade === 'F') {
      grade = 'C';
    }
  }
  if (hasSyntaxError) {
    if (grade === 'A+' || grade === 'A' || grade === 'B+' || grade === 'B') {
      grade = 'C';
    }
  }

  // 6. Calculate category health percentages (strictly clamped to [0, 100]%)
  const bugsHealth = Math.max(0, Math.min(100, Math.round(100 - categoryDeductions.SYNTAX)));
  const securityHealth = Math.max(0, Math.min(100, Math.round(100 - categoryDeductions.SECURITY)));
  const qualityHealth = Math.max(0, Math.min(100, Math.round(100 - categoryDeductions.QUALITY)));
  const optimizationHealth = Math.max(0, Math.min(100, Math.round(100 - categoryDeductions.OPTIMIZATION)));

  // 7. Build human-readable explanations array for UI inspection
  const explanations = [];

  if (hasSyntaxError) {
    explanations.push(
      `-${SYNTAX_PENALTY} pts: Syntax compilation failure penalty (code cannot compile, capped at Grade C)`
    );
  }
  if (severityCounts.CRITICAL > 0) {
    explanations.push(
      `-${severityDeductions.CRITICAL} pts: ${severityCounts.CRITICAL} CRITICAL issue(s) (-${PENALTY_WEIGHTS.CRITICAL} pts each)`
    );
  }
  if (severityCounts.HIGH > 0) {
    explanations.push(
      `-${severityDeductions.HIGH} pts: ${severityCounts.HIGH} HIGH issue(s) (-${PENALTY_WEIGHTS.HIGH} pts each)`
    );
  }
  if (severityCounts.MEDIUM > 0) {
    const isCapped = rawMediumDeduction > SEVERITY_CAPS.MEDIUM;
    explanations.push(
      `-${severityDeductions.MEDIUM} pts: ${severityCounts.MEDIUM} MEDIUM issue(s) (-${PENALTY_WEIGHTS.MEDIUM} pts each${isCapped ? `, capped at ${SEVERITY_CAPS.MEDIUM} pts max` : ''})`
    );
  }
  if (severityCounts.LOW > 0) {
    const isCapped = rawLowDeduction > SEVERITY_CAPS.LOW;
    explanations.push(
      `-${severityDeductions.LOW} pts: ${severityCounts.LOW} LOW issue(s) (-${PENALTY_WEIGHTS.LOW} pts each${isCapped ? `, capped at ${SEVERITY_CAPS.LOW} pts max` : ''})`
    );
  }
  if (severityCounts.INFO > 0) {
    explanations.push(`0 pts: ${severityCounts.INFO} Informational finding(s) (no penalty)`);
  }
  if (totalDeductions === 0) {
    explanations.push('0 pts: No defects detected. Perfect health rating.');
  }

  const summary = generateHealthSummary(finalScore, grade, findings.length, severityCounts.CRITICAL);

  return {
    healthScore: finalScore,
    health_score: finalScore, // Schema alias
    grade,
    totalDeductions,
    total_deductions: totalDeductions, // Schema alias
    summary,
    categoryScores: {
      bugsHealth,
      securityHealth,
      qualityHealth,
      optimizationHealth,
      bugs_health: bugsHealth,
      security_health: securityHealth,
      quality_health: qualityHealth,
      optimization_health: optimizationHealth,
    },
    metrics: {
      totalLines: lines,
      filesCount: files,
      issuesCount: findings.length,
    },
    breakdown: {
      severities: {
        CRITICAL: {
          count: severityCounts.CRITICAL,
          deduction: severityDeductions.CRITICAL,
          penaltyPerIssue: PENALTY_WEIGHTS.CRITICAL,
        },
        HIGH: {
          count: severityCounts.HIGH,
          deduction: severityDeductions.HIGH,
          penaltyPerIssue: PENALTY_WEIGHTS.HIGH,
        },
        MEDIUM: {
          count: severityCounts.MEDIUM,
          deduction: severityDeductions.MEDIUM,
          penaltyPerIssue: PENALTY_WEIGHTS.MEDIUM,
          cap: SEVERITY_CAPS.MEDIUM,
        },
        LOW: {
          count: severityCounts.LOW,
          deduction: severityDeductions.LOW,
          penaltyPerIssue: PENALTY_WEIGHTS.LOW,
          cap: SEVERITY_CAPS.LOW,
        },
        INFO: {
          count: severityCounts.INFO,
          deduction: severityDeductions.INFO,
          penaltyPerIssue: PENALTY_WEIGHTS.INFO,
        },
      },
      categories: {
        SYNTAX: {
          count: categoryCounts.SYNTAX,
          deduction: categoryDeductions.SYNTAX,
          health: bugsHealth,
        },
        SECURITY: {
          count: categoryCounts.SECURITY,
          deduction: categoryDeductions.SECURITY,
          health: securityHealth,
        },
        QUALITY: {
          count: categoryCounts.QUALITY,
          deduction: categoryDeductions.QUALITY,
          health: qualityHealth,
        },
        OPTIMIZATION: {
          count: categoryCounts.OPTIMIZATION,
          deduction: categoryDeductions.OPTIMIZATION,
          health: optimizationHealth,
        },
      },
      explanations,
    },
  };
}

module.exports = {
  PENALTY_WEIGHTS,
  SEVERITY_CAPS,
  GRADE_THRESHOLDS,
  getGrade,
  calculateScore,
};
