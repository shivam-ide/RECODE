const {
  calculateScore,
  getGrade,
  PENALTY_WEIGHTS,
  SEVERITY_CAPS,
  GRADE_THRESHOLDS,
} = require('../src/services/analysis/scoringEngine');

describe('Module 10: Health Scoring & Grading Engine (scoringEngine.js)', () => {
  // ============================================================================
  // SUITE 1: Penalty Weights & Grade Thresholds
  // ============================================================================
  describe('Penalty Weights and Grade Scale Integrity', () => {
    it('should adhere to the exact penalty weights: CRITICAL (20), HIGH (10), MEDIUM (3), LOW (0.5), INFO (0)', () => {
      expect(PENALTY_WEIGHTS).toEqual({
        CRITICAL: 20,
        HIGH: 10,
        MEDIUM: 3,
        LOW: 0.5,
        INFO: 0,
      });
    });

    it('should map score boundary values correctly to specified grade thresholds', () => {
      // 97-100: A+
      expect(getGrade(100)).toBe('A+');
      expect(getGrade(97)).toBe('A+');

      // 90-96: A
      expect(getGrade(96)).toBe('A');
      expect(getGrade(90)).toBe('A');

      // 80-89: B+
      expect(getGrade(89)).toBe('B+');
      expect(getGrade(80)).toBe('B+');

      // 70-79: B
      expect(getGrade(79)).toBe('B');
      expect(getGrade(70)).toBe('B');

      // 60-69: C
      expect(getGrade(69)).toBe('C');
      expect(getGrade(60)).toBe('C');

      // 50-59: D
      expect(getGrade(59)).toBe('D');
      expect(getGrade(50)).toBe('D');

      // <50: F
      expect(getGrade(49)).toBe('F');
      expect(getGrade(25)).toBe('F');
      expect(getGrade(0)).toBe('F');
      expect(getGrade(-10)).toBe('F');
    });
  });

  // ============================================================================
  // SUITE 2: Clean Project Inputs (Pristine Codebases)
  // ============================================================================
  describe('Clean Project Inputs (Grade A+)', () => {
    it('should assign score 100 and grade A+ for zero findings with perfect category health', () => {
      const result = calculateScore([], 250, 5);

      expect(result.healthScore).toBe(100);
      expect(result.health_score).toBe(100);
      expect(result.grade).toBe('A+');
      expect(result.totalDeductions).toBe(0);

      // All category health scores must be 100%
      expect(result.categoryScores).toMatchObject({
        bugsHealth: 100,
        securityHealth: 100,
        qualityHealth: 100,
        optimizationHealth: 100,
      });

      expect(result.metrics).toEqual({
        totalLines: 250,
        filesCount: 5,
        issuesCount: 0,
      });

      expect(result.summary).toContain('Grade A+');
    });

    it('should assign score 100 and grade A+ when only INFO findings are present (0 penalty)', () => {
      const infoFindings = [
        { severity: 'INFO', category: 'QUALITY', title: 'Consider adding JSDoc' },
        { severity: 'INFO', category: 'OPTIMIZATION', title: 'Minor memory footprint observation' },
      ];

      const result = calculateScore(infoFindings, 100, 1);

      expect(result.healthScore).toBe(100);
      expect(result.grade).toBe('A+');
      expect(result.totalDeductions).toBe(0);
      expect(result.breakdown.severities.INFO.count).toBe(2);
      expect(result.breakdown.severities.INFO.deduction).toBe(0);
    });
  });

  // ============================================================================
  // SUITE 3: Moderately Flawed Project Inputs
  // ============================================================================
  describe('Moderately Flawed Project Inputs', () => {
    it('should calculate grade A for 1 HIGH finding (-10 pts, score 90)', () => {
      const findings = [
        {
          severity: 'HIGH',
          category: 'SECURITY',
          title: 'Permissive CORS Configuration',
        },
      ];

      const result = calculateScore(findings, 500, 4);

      expect(result.healthScore).toBe(90);
      expect(result.grade).toBe('A');
      expect(result.totalDeductions).toBe(10);
      expect(result.categoryScores.securityHealth).toBe(90);
      expect(result.categoryScores.bugsHealth).toBe(100);
    });

    it('should calculate grade B+ for 1 CRITICAL finding (-20 pts, score 80)', () => {
      const findings = [
        {
          severity: 'CRITICAL',
          category: 'SECURITY',
          title: 'SQL Injection Vulnerability',
        },
      ];

      const result = calculateScore(findings, 320, 2);

      expect(result.healthScore).toBe(80);
      expect(result.grade).toBe('B+');
      expect(result.totalDeductions).toBe(20);
      expect(result.categoryScores.securityHealth).toBe(80);
    });

    it('should calculate grade B for 1 CRITICAL and 1 MEDIUM finding (-23 pts, score 77)', () => {
      const findings = [
        { severity: 'CRITICAL', category: 'SECURITY', title: 'Hardcoded API Secret' }, // -20
        { severity: 'MEDIUM', category: 'QUALITY', title: 'Empty Catch Block' }, // -3
      ];

      const result = calculateScore(findings, 600, 3);

      expect(result.healthScore).toBe(77);
      expect(result.grade).toBe('B');
      expect(result.totalDeductions).toBe(23);
      expect(result.categoryScores.securityHealth).toBe(80);
    });

    it('should calculate grade C for diverse mixed findings (-33.5 pts, score 67)', () => {
      const findings = [
        { severity: 'CRITICAL', category: 'SECURITY', title: 'SQL Injection' }, // -20
        { severity: 'HIGH', category: 'OPTIMIZATION', title: 'Quadratic Loop' }, // -10
        { severity: 'MEDIUM', category: 'QUALITY', title: 'Empty Catch' }, // -3
        { severity: 'LOW', category: 'QUALITY', title: 'Console.log in Prod' }, // -0.5
      ];

      const result = calculateScore(findings, 1200, 8);

      expect(result.healthScore).toBe(67);
      expect(result.grade).toBe('C');
      expect(result.totalDeductions).toBe(33.5);
      expect(result.categoryScores.securityHealth).toBe(80);
      expect(result.categoryScores.optimizationHealth).toBe(90);
    });

    it('should calculate grade D for 2 CRITICAL and 1 HIGH finding (-50 pts, score 50)', () => {
      const findings = [
        { severity: 'CRITICAL', category: 'SECURITY', title: 'SQLi' }, // -20
        { severity: 'CRITICAL', category: 'SECURITY', title: 'Hardcoded Secret' }, // -20
        { severity: 'HIGH', category: 'SECURITY', title: 'Open Redirect' }, // -10
      ];

      const result = calculateScore(findings, 850, 4);

      expect(result.healthScore).toBe(50);
      expect(result.grade).toBe('D');
      expect(result.totalDeductions).toBe(50);
      expect(result.categoryScores.securityHealth).toBe(50);
    });
  });

  // ============================================================================
  // SUITE 4: Completely Broken Project Inputs (F Grade)
  // ============================================================================
  describe('Completely Broken Project Inputs (F Grade)', () => {
    it('should clamp health score to exactly 0 and grade F when deductions equal or exceed 100', () => {
      const brokenFindings = [
        { severity: 'CRITICAL', category: 'SECURITY' }, // -20
        { severity: 'CRITICAL', category: 'SECURITY' }, // -20
        { severity: 'CRITICAL', category: 'SECURITY' }, // -20
        { severity: 'CRITICAL', category: 'SECURITY' }, // -20
        { severity: 'CRITICAL', category: 'SECURITY' }, // -20
        { severity: 'HIGH', category: 'QUALITY' }, // -10 (Total: 110)
      ];

      const result = calculateScore(brokenFindings, 400, 2);

      expect(result.totalDeductions).toBe(110);
      expect(result.healthScore).toBe(0); // Clamped at 0 (never negative)
      expect(result.grade).toBe('F');
      expect(result.categoryScores.securityHealth).toBe(0); // Clamped at 0
    });
  });

  // ============================================================================
  // SUITE 5: Syntax Errors & Unparsed Files Penalty
  // ============================================================================
  describe('Syntax Error and Unparsed File Incur Minimum HIGH Penalty', () => {
    it('should incur automatic 30 points penalty and cap at Grade C when a syntax error is present', () => {
      const findings = [
        {
          ruleId: 'PARSER_ERROR',
          category: 'SYNTAX',
          severity: 'HIGH',
          title: 'Syntax Error in Source Code',
        },
      ];

      const result = calculateScore(findings, 50, 1);

      expect(result.totalDeductions).toBe(30);
      expect(result.healthScore).toBe(70);
      expect(result.grade).toBe('C');
      expect(result.categoryScores.bugsHealth).toBe(70);
      expect(result.breakdown.categories.SYNTAX.deduction).toBe(30);
    });

    it('should incur 30 points penalty and cap at Grade C when unparsedFiles option is specified', () => {
      const result = calculateScore([], 0, 1, { unparsedFiles: 1 });

      expect(result.totalDeductions).toBe(30);
      expect(result.healthScore).toBe(70);
      expect(result.grade).toBe('C');
      expect(result.categoryScores.bugsHealth).toBe(70);
    });

    it('should combine syntax penalty with other vulnerability penalties (dropping to Grade D or F)', () => {
      const findings = [
        { ruleId: 'PARSER_ERROR', category: 'SYNTAX', severity: 'HIGH' }, // -30
        { ruleId: 'SQL_INJECTION', category: 'SECURITY', severity: 'CRITICAL' }, // -20
      ];

      const result = calculateScore(findings, 200, 2);

      expect(result.totalDeductions).toBe(50);
      expect(result.healthScore).toBe(50);
      expect(result.grade).toBe('D');
      expect(result.categoryScores.bugsHealth).toBe(70);
      expect(result.categoryScores.securityHealth).toBe(80);
    });
  });

  // ============================================================================
  // SUITE 6: Transparent Breakdown Structure for Frontend Inspection
  // ============================================================================
  describe('Transparent Deduction Breakdown Structure', () => {
    it('should output complete transparent breakdown object with severity counts, category scores, and explanations', () => {
      const findings = [
        { severity: 'CRITICAL', category: 'SECURITY', title: 'SQL Injection' },
        { severity: 'MEDIUM', category: 'QUALITY', title: 'Empty Catch' },
        { severity: 'LOW', category: 'QUALITY', title: 'Console Log' },
        { severity: 'INFO', category: 'OPTIMIZATION', title: 'Formatting Tip' },
      ];

      const result = calculateScore(findings, 750, 4);

      // Verify breakdown object properties
      expect(result).toHaveProperty('breakdown');
      const { breakdown } = result;

      // Severity breakdown
      expect(breakdown.severities.CRITICAL).toEqual({ count: 1, deduction: 20, penaltyPerIssue: 20 });
      expect(breakdown.severities.HIGH).toEqual({ count: 0, deduction: 0, penaltyPerIssue: 10 });
      expect(breakdown.severities.MEDIUM).toEqual({ count: 1, deduction: 3, penaltyPerIssue: 3, cap: 20 });
      expect(breakdown.severities.LOW).toEqual({ count: 1, deduction: 0.5, penaltyPerIssue: 0.5, cap: 15 });
      expect(breakdown.severities.INFO).toEqual({ count: 1, deduction: 0, penaltyPerIssue: 0 });

      // Explanations array
      expect(Array.isArray(breakdown.explanations)).toBe(true);
      expect(breakdown.explanations.some((e) => e.includes('CRITICAL'))).toBe(true);
      expect(breakdown.explanations.some((e) => e.includes('MEDIUM'))).toBe(true);
      expect(breakdown.explanations.some((e) => e.includes('LOW'))).toBe(true);
    });

    it('should support options object parameter signature', () => {
      const findings = [{ severity: 'HIGH', category: 'QUALITY', title: 'High Flaw' }];
      const result = calculateScore({
        findings,
        totalLines: 1000,
        filesCount: 10,
      });

      expect(result.healthScore).toBe(90);
      expect(result.metrics.totalLines).toBe(1000);
      expect(result.metrics.filesCount).toBe(10);
      expect(result.metrics.issuesCount).toBe(1);
    });
  });

  // ============================================================================
  // SUITE 7: Penalty Capping & Zero-Critical/Zero-High Protection
  // ============================================================================
  describe('Penalty Capping & Zero-Critical/Zero-High Minimum Grade C Protection', () => {
    it('should cap LOW issues at 15 points max (BenchmarkJava scenario with 49 LOW console logs)', () => {
      // 49 LOW console logs = 49 * 0.5 = 24.5 pts -> capped at 15 pts
      const lowFindings = Array.from({ length: 49 }, (_, i) => ({
        severity: 'LOW',
        category: 'QUALITY',
        ruleId: 'CONSOLE_LOG_STMT',
        title: 'Console log statement found',
        line: i + 1,
      }));

      const result = calculateScore(lowFindings, 1200, 10);

      expect(result.totalDeductions).toBe(15);
      expect(result.healthScore).toBe(85);
      expect(result.grade).toBe('B+');
      expect(result.breakdown.severities.LOW.deduction).toBe(15);
      expect(result.breakdown.severities.LOW.count).toBe(49);
    });

    it('should cap MEDIUM issues at 20 points max', () => {
      // 20 MEDIUM issues = 20 * 3 = 60 pts -> capped at 20 pts
      const medFindings = Array.from({ length: 20 }, (_, i) => ({
        severity: 'MEDIUM',
        category: 'QUALITY',
        ruleId: 'EMPTY_CATCH_BLOCK',
        title: 'Empty catch block',
        line: i + 1,
      }));

      const result = calculateScore(medFindings, 800, 5);

      expect(result.totalDeductions).toBe(20);
      expect(result.healthScore).toBe(80);
      expect(result.grade).toBe('B+');
      expect(result.breakdown.severities.MEDIUM.deduction).toBe(20);
    });

    it('should ensure a project with 0 Critical and 0 High issues NEVER drops below Grade C (minimum score 70)', () => {
      // Even with 100 LOW issues (capped at 15) and 50 MEDIUM issues (capped at 20)
      const manyFindings = [
        ...Array.from({ length: 100 }, (_, i) => ({ severity: 'LOW', category: 'QUALITY', line: i + 1 })),
        ...Array.from({ length: 50 }, (_, i) => ({ severity: 'MEDIUM', category: 'QUALITY', line: i + 1 })),
      ];

      const result = calculateScore(manyFindings, 2000, 15);

      // Total deductions capped at 15 + 20 = 35 -> raw score 65, clamped to min 70
      expect(result.healthScore).toBeGreaterThanOrEqual(70);
      expect(['A+', 'A', 'B+', 'B', 'C']).toContain(result.grade);
      expect(result.grade).not.toBe('D');
      expect(result.grade).not.toBe('F');
    });
  });
});
