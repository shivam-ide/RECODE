const {
  mergeAndDeduplicate,
  sortFindingsBySeverity,
  isSameFile,
  isMatchingRuleOrCategory,
  resolveSeverity,
  SEVERITY_ORDER,
  SEVERITY_WEIGHTS,
} = require('../src/services/analysis/findingsNormalizer');

describe('Module 9: Findings Normalizer & Deduplication (findingsNormalizer.js)', () => {
  // ============================================================================
  // SUITE 1: Helper Utilities & Configuration
  // ============================================================================
  describe('Helper Utilities & Configuration', () => {
    it('should define standard severity ordering and weights', () => {
      expect(SEVERITY_ORDER).toEqual(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);
      expect(SEVERITY_WEIGHTS.CRITICAL).toBe(1);
      expect(SEVERITY_WEIGHTS.HIGH).toBe(2);
      expect(SEVERITY_WEIGHTS.MEDIUM).toBe(3);
      expect(SEVERITY_WEIGHTS.LOW).toBe(4);
      expect(SEVERITY_WEIGHTS.INFO).toBe(5);
    });

    it('should correctly match file paths regardless of slashes or case', () => {
      expect(isSameFile('src\\services\\auth.js', 'src/services/auth.js')).toBe(true);
      expect(isSameFile('src/auth.js', 'auth.js')).toBe(true);
      expect(isSameFile('snippet', 'snippet')).toBe(true);
      expect(isSameFile('src/user.js', 'src/order.js')).toBe(false);
      expect(isSameFile(null, null)).toBe(true);
      expect(isSameFile('auth.js', null)).toBe(false);
    });

    it('should correlate rules and categories between AST and AI findings', () => {
      expect(
        isMatchingRuleOrCategory({ category: 'SECURITY' }, { category: 'SECURITY' })
      ).toBe(true);

      expect(
        isMatchingRuleOrCategory(
          { ruleId: 'SQL_INJECTION', category: 'SECURITY' },
          { title: 'SQL Injection Vulnerability', category: 'SECURITY' }
        )
      ).toBe(true);

      expect(
        isMatchingRuleOrCategory(
          { ruleId: 'HARDCODED_SECRET', category: 'SECURITY' },
          { title: 'Exposed API Token', explanation: 'Secret token found', category: 'SECURITY' }
        )
      ).toBe(true);

      expect(
        isMatchingRuleOrCategory(
          { ruleId: 'SQL_INJECTION', category: 'SECURITY' },
          { title: 'Inefficient O(N^2) Loop', category: 'OPTIMIZATION' }
        )
      ).toBe(false);
    });

    it('should resolve higher severity correctly when merging overlaps', () => {
      expect(resolveSeverity('HIGH', 'CRITICAL')).toBe('CRITICAL');
      expect(resolveSeverity('CRITICAL', 'HIGH')).toBe('CRITICAL');
      expect(resolveSeverity('MEDIUM', 'LOW')).toBe('MEDIUM');
      expect(resolveSeverity('INFO', 'HIGH')).toBe('HIGH');
      expect(resolveSeverity('UNKNOWN', 'LOW')).toBe('LOW');
    });
  });

  // ============================================================================
  // SUITE 2: Deduplication and Overlap Merging (+/- 2 lines)
  // ============================================================================
  describe('Deduplication and Overlap Merging', () => {
    it('should merge exact line match into a single HYBRID finding with Gemini explanation & diff', () => {
      const staticFindings = [
        {
          file: 'src/repo/userRepo.js',
          line: 10,
          severity: 'CRITICAL',
          category: 'SECURITY',
          ruleId: 'SQL_INJECTION',
          title: 'SQL Injection Vulnerability (CWE-89)',
          description: 'Direct concatenation detected in db.query',
          evidence: 'db.query("SELECT * FROM users WHERE id = " + userId)',
          source: 'STATIC',
        },
      ];

      const aiFindings = [
        {
          file: 'src/repo/userRepo.js',
          line: 10,
          severity: 'CRITICAL',
          category: 'SECURITY',
          title: 'Remote SQL Injection in User Lookup',
          explanation:
            'Unsanitized user-supplied identifier is concatenated into raw query. Use parameterized values.',
          diff_before: 'db.query("SELECT * FROM users WHERE id = " + userId)',
          diff_after: 'db.query("SELECT * FROM users WHERE id = $1", [userId])',
          source: 'GEMINI',
        },
      ];

      const merged = mergeAndDeduplicate(staticFindings, aiFindings);

      expect(merged).toHaveLength(1); // De-duplicated count = 1
      const item = merged[0];

      expect(item).toMatchObject({
        file: 'src/repo/userRepo.js',
        line: 10,
        severity: 'CRITICAL',
        category: 'SECURITY',
        ruleId: 'SQL_INJECTION',
        title: 'Remote SQL Injection in User Lookup',
        explanation:
          'Unsanitized user-supplied identifier is concatenated into raw query. Use parameterized values.',
        diff_before: 'db.query("SELECT * FROM users WHERE id = " + userId)',
        diff_after: 'db.query("SELECT * FROM users WHERE id = $1", [userId])',
        source: 'HYBRID',
        engine_source: 'HYBRID',
      });
    });

    it('should merge when line numbers are within proximity (+/- 1 line) retaining AST line number', () => {
      const staticFindings = [
        {
          file: 'src/auth.js',
          line: 25, // AST line number
          severity: 'CRITICAL',
          category: 'SECURITY',
          ruleId: 'HARDCODED_SECRET',
          title: 'Hardcoded Secret',
          description: 'Static secret in source code',
          evidence: 'const secret = "sk_live_1234567890abcdef";',
          source: 'STATIC',
        },
      ];

      const aiFindings = [
        {
          file: 'src/auth.js',
          line: 26, // AI slightly offset by 1 line
          severity: 'CRITICAL',
          category: 'SECURITY',
          title: 'Exposed Production API Secret',
          explanation: 'Secret key is committed to source control. Move to process.env.',
          diff_before: 'const secret = "sk_live_1234567890abcdef";',
          diff_after: 'const secret = process.env.API_SECRET;',
          source: 'GEMINI',
        },
      ];

      const merged = mergeAndDeduplicate(staticFindings, aiFindings);

      expect(merged).toHaveLength(1);
      expect(merged[0].line).toBe(25); // Must retain precise AST line number
      expect(merged[0].source).toBe('HYBRID');
      expect(merged[0].diff_after).toBe('const secret = process.env.API_SECRET;');
    });

    it('should merge when line numbers are within proximity (+/- 2 lines)', () => {
      const staticFindings = [
        {
          file: 'src/task.js',
          line: 40,
          severity: 'MEDIUM',
          category: 'QUALITY',
          ruleId: 'EMPTY_CATCH_BLOCK',
          title: 'Empty Catch Block',
          description: 'Catch block without handling',
          evidence: '} catch (e) {',
          source: 'STATIC',
        },
      ];

      const aiFindings = [
        {
          file: 'src/task.js',
          line: 42, // Exactly 2 lines away
          severity: 'MEDIUM',
          category: 'QUALITY',
          title: 'Swallowed Exception in Task Execution',
          explanation: 'Unhandled error is silenced, causing silent failures. Add structured logging.',
          diff_before: '} catch (e) {}',
          diff_after: '} catch (e) { logger.error("Task failed", e); throw e; }',
          source: 'GEMINI',
        },
      ];

      const merged = mergeAndDeduplicate(staticFindings, aiFindings);

      expect(merged).toHaveLength(1);
      expect(merged[0].line).toBe(40);
      expect(merged[0].source).toBe('HYBRID');
    });

    it('should NOT merge findings that exceed proximity threshold (> 2 lines apart)', () => {
      const staticFindings = [
        {
          file: 'src/service.js',
          line: 10,
          severity: 'LOW',
          category: 'QUALITY',
          ruleId: 'UNUSED_VARIABLE',
          title: 'Unused Variable',
          description: 'Variable unused is declared but never read',
          evidence: 'const unused = 1;',
          source: 'STATIC',
        },
      ];

      const aiFindings = [
        {
          file: 'src/service.js',
          line: 15, // 5 lines away (> 2)
          severity: 'LOW',
          category: 'QUALITY',
          title: 'Unused Configuration Variable',
          explanation: 'Remove dead code to reduce cognitive overhead.',
          diff_before: 'const unused = 1;',
          diff_after: '',
          source: 'GEMINI',
        },
      ];

      const merged = mergeAndDeduplicate(staticFindings, aiFindings);

      // Should retain both as distinct independent findings
      expect(merged).toHaveLength(2);
      expect(merged.some((f) => f.source === 'STATIC' && f.line === 10)).toBe(true);
      expect(merged.some((f) => f.source === 'GEMINI' && f.line === 15)).toBe(true);
    });

    it('should NOT merge findings from different files even if on the exact same line', () => {
      const staticFindings = [
        {
          file: 'src/controllers/authController.js',
          line: 12,
          severity: 'CRITICAL',
          category: 'SECURITY',
          ruleId: 'SQL_INJECTION',
          source: 'STATIC',
        },
      ];

      const aiFindings = [
        {
          file: 'src/controllers/orderController.js', // Different file!
          line: 12,
          severity: 'CRITICAL',
          category: 'SECURITY',
          title: 'SQL Injection in Orders',
          source: 'GEMINI',
        },
      ];

      const merged = mergeAndDeduplicate(staticFindings, aiFindings);

      expect(merged).toHaveLength(2);
      expect(merged.some((f) => f.file === 'src/controllers/authController.js' && f.source === 'STATIC')).toBe(true);
      expect(merged.some((f) => f.file === 'src/controllers/orderController.js' && f.source === 'GEMINI')).toBe(true);
    });
  });

  // ============================================================================
  // SUITE 3: Preserving Independent Findings (STATIC vs GEMINI)
  // ============================================================================
  describe('Preservation of Independent Static and AI Findings', () => {
    it('should preserve PARSER_ERROR findings strictly as STATIC', () => {
      const staticFindings = [
        {
          file: 'src/broken.js',
          line: 3,
          severity: 'HIGH',
          category: 'SYNTAX',
          ruleId: 'PARSER_ERROR',
          title: 'Syntax Error in Source Code',
          description: "Unexpected token '{'",
          evidence: 'function parse( {',
          source: 'STATIC',
        },
      ];

      const aiFindings = [
        {
          file: 'src/broken.js',
          line: 3,
          severity: 'HIGH',
          category: 'SYNTAX',
          title: 'Malformed Function Signature',
          explanation: 'Function declaration syntax is invalid.',
          diff_before: 'function parse( {',
          diff_after: 'function parse() {',
          source: 'GEMINI',
        },
      ];

      const merged = mergeAndDeduplicate(staticFindings, aiFindings);

      // PARSER_ERROR remains independent STATIC finding
      const parserIssue = merged.find((f) => f.ruleId === 'PARSER_ERROR');
      expect(parserIssue).toBeDefined();
      expect(parserIssue.source).toBe('STATIC');
      expect(parserIssue.category).toBe('SYNTAX');
    });

    it('should preserve independent AI architectural and optimization findings as GEMINI', () => {
      const staticFindings = []; // No static AST findings

      const aiFindings = [
        {
          file: 'src/algorithms/search.js',
          line: 75,
          severity: 'HIGH',
          category: 'OPTIMIZATION',
          title: 'Quadratic O(N^2) Nested Array Scan',
          explanation:
            'Array.prototype.find inside Array.prototype.forEach degrades performance severely on large datasets. Replace with Map lookup.',
          diff_before: 'items.forEach(i => lookup.find(l => l.id === i.id))',
          diff_after: 'const map = new Map(lookup.map(l => [l.id, l])); items.forEach(i => map.get(i.id))',
          source: 'GEMINI',
        },
        {
          file: 'src/server.js',
          line: 120,
          severity: 'MEDIUM',
          category: 'QUALITY',
          title: 'Unhandled Event Loop Rejection Risk',
          explanation: 'Missing process.on("unhandledRejection") handler may crash Node process.',
          diff_before: 'app.listen(port);',
          diff_after: 'process.on("unhandledRejection", logError); app.listen(port);',
          source: 'GEMINI',
        },
      ];

      const merged = mergeAndDeduplicate(staticFindings, aiFindings);

      expect(merged).toHaveLength(2);
      expect(merged[0].source).toBe('GEMINI');
      expect(merged[0].category).toBe('OPTIMIZATION');
      expect(merged[1].source).toBe('GEMINI');
      expect(merged[1].category).toBe('QUALITY');
    });
  });

  // ============================================================================
  // SUITE 4: Strict Severity Sorting Order (CRITICAL -> HIGH -> MEDIUM -> LOW -> INFO)
  // ============================================================================
  describe('Strict Severity Sorting Order', () => {
    it('should sort combined findings strictly: CRITICAL -> HIGH -> MEDIUM -> LOW -> INFO', () => {
      const unsorted = [
        { file: 'a.js', line: 10, severity: 'LOW', title: 'Low issue' },
        { file: 'a.js', line: 20, severity: 'CRITICAL', title: 'Critical issue' },
        { file: 'a.js', line: 30, severity: 'INFO', title: 'Info issue' },
        { file: 'a.js', line: 40, severity: 'HIGH', title: 'High issue' },
        { file: 'a.js', line: 50, severity: 'MEDIUM', title: 'Medium issue' },
      ];

      const sorted = sortFindingsBySeverity(unsorted);

      const severities = sorted.map((f) => f.severity);
      expect(severities).toEqual(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);
    });

    it('should perform secondary sorting by file name and line number within identical severities', () => {
      const sameSeverity = [
        { file: 'src/z.js', line: 50, severity: 'HIGH', title: 'Issue 3' },
        { file: 'src/a.js', line: 100, severity: 'HIGH', title: 'Issue 2' },
        { file: 'src/a.js', line: 10, severity: 'HIGH', title: 'Issue 1' },
      ];

      const sorted = sortFindingsBySeverity(sameSeverity);

      expect(sorted[0].file).toBe('src/a.js');
      expect(sorted[0].line).toBe(10);

      expect(sorted[1].file).toBe('src/a.js');
      expect(sorted[1].line).toBe(100);

      expect(sorted[2].file).toBe('src/z.js');
      expect(sorted[2].line).toBe(50);
    });

    it('should output end-to-end merged findings sorted in proper severity order', () => {
      const staticFindings = [
        {
          file: 'src/app.js',
          line: 5,
          severity: 'LOW',
          category: 'QUALITY',
          ruleId: 'CONSOLE_LOG_STMT',
          source: 'STATIC',
        },
        {
          file: 'src/app.js',
          line: 12,
          severity: 'CRITICAL',
          category: 'SECURITY',
          ruleId: 'SQL_INJECTION',
          source: 'STATIC',
        },
      ];

      const aiFindings = [
        {
          file: 'src/app.js',
          line: 12,
          severity: 'CRITICAL',
          category: 'SECURITY',
          title: 'Critical SQL Injection',
          explanation: 'Remediation details',
          diff_before: 'raw_sql',
          diff_after: 'param_sql',
          source: 'GEMINI',
        },
        {
          file: 'src/app.js',
          line: 80,
          severity: 'HIGH',
          category: 'OPTIMIZATION',
          title: 'High CPU Loop',
          explanation: 'Expensive calculation',
          source: 'GEMINI',
        },
        {
          file: 'src/app.js',
          line: 95,
          severity: 'INFO',
          category: 'QUALITY',
          title: 'Code Formatting Tip',
          explanation: 'Style suggestion',
          source: 'GEMINI',
        },
      ];

      const result = mergeAndDeduplicate(staticFindings, aiFindings);

      // Total findings count:
      // - line 12 static + line 12 AI merged into 1 HYBRID (CRITICAL)
      // - line 80 AI preserved (HIGH)
      // - line 5 static preserved (LOW)
      // - line 95 AI preserved (INFO)
      // Total count = 4
      expect(result).toHaveLength(4);

      const severities = result.map((f) => f.severity);
      expect(severities).toEqual(['CRITICAL', 'HIGH', 'LOW', 'INFO']);

      // Check sources
      expect(result[0].source).toBe('HYBRID');
      expect(result[1].source).toBe('GEMINI');
      expect(result[2].source).toBe('STATIC');
      expect(result[3].source).toBe('GEMINI');
    });
  });

  // ============================================================================
  // SUITE 5: Empty and Edge Case Handling
  // ============================================================================
  describe('Empty and Edge Case Handling', () => {
    it('should return an empty array when both inputs are empty or null', () => {
      expect(mergeAndDeduplicate([], [])).toEqual([]);
      expect(mergeAndDeduplicate(null, null)).toEqual([]);
      expect(mergeAndDeduplicate(undefined, undefined)).toEqual([]);
    });

    it('should correctly handle only static findings provided', () => {
      const staticOnly = [
        { file: 'test.js', line: 10, severity: 'MEDIUM', ruleId: 'EMPTY_CATCH_BLOCK', source: 'STATIC' },
        { file: 'test.js', line: 2, severity: 'CRITICAL', ruleId: 'HARDCODED_SECRET', source: 'STATIC' },
      ];

      const result = mergeAndDeduplicate(staticOnly, []);

      expect(result).toHaveLength(2);
      expect(result[0].severity).toBe('CRITICAL');
      expect(result[0].source).toBe('STATIC');
      expect(result[1].severity).toBe('MEDIUM');
      expect(result[1].source).toBe('STATIC');
    });

    it('should correctly handle only AI findings provided', () => {
      const aiOnly = [
        { file: 'test.js', line: 10, severity: 'INFO', title: 'Info tip', source: 'GEMINI' },
        { file: 'test.js', line: 5, severity: 'HIGH', title: 'High flaw', source: 'GEMINI' },
      ];

      const result = mergeAndDeduplicate([], aiOnly);

      expect(result).toHaveLength(2);
      expect(result[0].severity).toBe('HIGH');
      expect(result[0].source).toBe('GEMINI');
      expect(result[1].severity).toBe('INFO');
      expect(result[1].source).toBe('GEMINI');
    });
  });
});
