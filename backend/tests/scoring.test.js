const {
  calculateScore,
  getGrade,
  PENALTY_WEIGHTS,
  GRADE_THRESHOLDS,
} = require('../src/services/analysis/scoringEngine');

describe('Module 10: Health Scoring & Grading Engine (scoringEngine.js)', () => {
  // ============================================================================
  // SUITE 1: Penalty Weights & Grade Thresholds
  // ============================================================================
  describe('Penalty Weights and Grade Scale Integrity', () => {
    it('should adhere to the exact penalty weights: CRITICAL (20), HIGH (10), MEDIUM (5), LOW (2), INFO (0)', () => {
      expect(PENALTY_WEIGHTS).toEqual({
        CRITICAL: 20,
        HIGH: 10,
        MEDIUM: 5,
        LOW: 2,
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

    it('should calculate grade B for 1 CRITICAL and 1 MEDIUM finding (-25 pts, score 75)', () => {
      const findings = [
        { severity: 'CRITICAL', category: 'SECURITY', title: 'Hardcoded API Secret' }, // -20
        { severity: 'MEDIUM', category: 'QUALITY', title: 'Empty Catch Block' }, // -5
      ];

      const result = calculateScore(findings, 600, 3);

      expect(result.healthScore).toBe(75);
      expect(result.grade).toBe('B');
      expect(result.totalDeductions).toBe(25);
      expect(result.categoryScores.securityHealth).toBe(80);
      expect(result.categoryScores.qualityHealth).toBe(95);
    });

    it('should calculate grade C for diverse mixed findings (-37 pts, score 63)', () => {
      const findings = [
        { severity: 'CRITICAL', category: 'SECURITY', title: 'SQL Injection' }, // -20
        { severity: 'HIGH', category: 'OPTIMIZATION', title: 'Quadratic Loop' }, // -10
        { severity: 'MEDIUM', category: 'QUALITY', title: 'Empty Catch' }, // -5
        { severity: 'LOW', category: 'QUALITY', title: 'Console.log in Prod' }, // -2
      ];

      const result = calculateScore(findings, 1200, 8);

      expect(result.healthScore).toBe(63);
      expect(result.grade).toBe('C');
      expect(result.totalDeductions).toBe(37);
      expect(result.categoryScores.securityHealth).toBe(80);
      expect(result.categoryScores.optimizationHealth).toBe(90);
      expect(result.categoryScores.qualityHealth).toBe(93); // 100 - 7
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
      expect(result.categoryScores.qualityHealth).toBe(90);
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
      expect(breakdown.severities.MEDIUM).toEqual({ count: 1, deduction: 5, penaltyPerIssue: 5 });
      expect(breakdown.severities.LOW).toEqual({ count: 1, deduction: 2, penaltyPerIssue: 2 });
      expect(breakdown.severities.INFO).toEqual({ count: 1, deduction: 0, penaltyPerIssue: 0 });

      // Category breakdown
      expect(breakdown.categories.SECURITY).toEqual({ count: 1, deduction: 20, health: 80 });
      expect(breakdown.categories.QUALITY).toEqual({ count: 2, deduction: 7, health: 93 });
      expect(breakdown.categories.OPTIMIZATION).toEqual({ count: 1, deduction: 0, health: 100 });
      expect(breakdown.categories.SYNTAX).toEqual({ count: 0, deduction: 0, health: 100 });

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
});
