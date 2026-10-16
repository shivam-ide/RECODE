const { validateEnvironment } = require('../src/config/envValidator');
const { analyzeFile, RULES } = require('../src/services/analysis/staticAnalyzer');
const { reviewCodeWithGemini } = require('../src/services/ai/aiReviewer');
const { mergeAndDeduplicate } = require('../src/services/analysis/findingsNormalizer');
const { calculateScore, getGrade } = require('../src/services/analysis/scoringEngine');

describe('End-to-End Diagnostic Audit & Self-Healing Verification Suite', () => {
  // ==========================================================================
  // PROTOCOL 1: Environment Integrity & Startup Auditing
  // ==========================================================================
  describe('Protocol 1: Environment & Backend Integrity', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    test('validates full environment when all variables are present', () => {
      process.env.PORT = '5000';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
      process.env.GEMINI_API_KEY = 'valid-gemini-key-123';

      const report = validateEnvironment();
      expect(report.isValid).toBe(true);
      expect(report.partialMode).toBe(false);
      expect(report.missingVars).toHaveLength(0);
      expect(report.config.port).toBe(5000);
      expect(report.config.geminiConfigured).toBe(true);
    });

    test('gracefully enters Partial Analysis Mode when GEMINI_API_KEY is missing without throwing', () => {
      delete process.env.GEMINI_API_KEY;

      const report = validateEnvironment();
      expect(report.partialMode).toBe(true);
      expect(report.config.geminiConfigured).toBe(false);
      expect(report.warnings.some((w) => w.includes('Partial Analysis Mode'))).toBe(true);
    });

    test('identifies missing critical database variables without crash', () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;

      const report = validateEnvironment();
      expect(report.isValid).toBe(false);
      expect(report.missingVars).toContain('SUPABASE_URL');
      expect(report.missingVars).toContain('SUPABASE_ANON_KEY');
    });
  });

  // ==========================================================================
  // PROTOCOL 2: Safe Parsing & Parser Edge Cases across 5 Languages
  // ==========================================================================
  describe('Protocol 2: Dual-Engine Pipeline & Safe Parser Verification', () => {
    test('handles incomplete JavaScript cleanly with normalized PARSER_ERROR finding without crashing', () => {
      const incompleteJs = 'function calculateTotal(items) {\n  if (items.length > 0) {\n    return items.reduce((a, b) => a + b;\n';
      const findings = analyzeFile('checkout.js', incompleteJs, 'javascript');

      expect(Array.isArray(findings)).toBe(true);
      expect(findings.length).toBeGreaterThan(0);
      const syntaxFinding = findings.find((f) => f.ruleId === 'PARSER_ERROR');
      expect(syntaxFinding).toBeDefined();
      expect(syntaxFinding.severity).toBe('HIGH');
      expect(syntaxFinding.category).toBe('SYNTAX');
    });

    test('handles incomplete TypeScript with missing closing braces cleanly without crashing', () => {
      const incompleteTs = 'interface User {\n  id: string;\n  name: string;\n\nclass UserService {\n  getUser(): User {\n    return { id: "1", name: "Alice" };';
      const findings = analyzeFile('user.ts', incompleteTs, 'typescript');

      expect(Array.isArray(findings)).toBe(true);
      const syntaxFinding = findings.find((f) => f.ruleId === 'PARSER_ERROR');
      expect(syntaxFinding).toBeDefined();
      expect(syntaxFinding.severity).toBe('HIGH');
      expect(syntaxFinding.category).toBe('SYNTAX');
    });

    test('handles incomplete Python (unclosed header at EOF) cleanly as normalized PARSER_ERROR', () => {
      const incompletePython = 'import os\n\ndef process_data(records):\n    if len(records) > 0:';
      const findings = analyzeFile('processor.py', incompletePython, 'python');

      expect(Array.isArray(findings)).toBe(true);
      const syntaxFinding = findings.find((f) => f.ruleId === 'PARSER_ERROR');
      expect(syntaxFinding).toBeDefined();
      expect(syntaxFinding.severity).toBe('HIGH');
      expect(syntaxFinding.category).toBe('SYNTAX');
    });

    test('handles incomplete Python unclosed multiline string cleanly as normalized PARSER_ERROR', () => {
      const unclosedStringPy = '"""This is an unclosed docstring at EOF\nfunction does not complete';
      const findings = analyzeFile('module.py', unclosedStringPy, 'python');

      expect(Array.isArray(findings)).toBe(true);
      const syntaxFinding = findings.find((f) => f.ruleId === 'PARSER_ERROR');
      expect(syntaxFinding).toBeDefined();
      expect(syntaxFinding.severity).toBe('HIGH');
      expect(syntaxFinding.category).toBe('SYNTAX');
    });

    test('handles incomplete Java (unclosed opening brace at EOF) cleanly as normalized PARSER_ERROR', () => {
      const incompleteJava = 'public class OrderController {\n    public void processOrder() {\n        System.out.println("Processing");\n';
      const findings = analyzeFile('OrderController.java', incompleteJava, 'java');

      expect(Array.isArray(findings)).toBe(true);
      const syntaxFinding = findings.find((f) => f.ruleId === 'PARSER_ERROR');
      expect(syntaxFinding).toBeDefined();
      expect(syntaxFinding.severity).toBe('HIGH');
      expect(syntaxFinding.category).toBe('SYNTAX');
    });

    test('handles incomplete C++ (unclosed opening brace at EOF) cleanly as normalized PARSER_ERROR', () => {
      const incompleteCpp = '#include <iostream>\n\nint main() {\n    std::cout << "Hello";\n';
      const findings = analyzeFile('main.cpp', incompleteCpp, 'cpp');

      expect(Array.isArray(findings)).toBe(true);
      const syntaxFinding = findings.find((f) => f.ruleId === 'PARSER_ERROR');
      expect(syntaxFinding).toBeDefined();
      expect(syntaxFinding.severity).toBe('HIGH');
      expect(syntaxFinding.category).toBe('SYNTAX');
    });
  });

  // ==========================================================================
  // PROTOCOL 2.B: Gemini AI Response Markdown Sanitation & Fallback
  // ==========================================================================
  describe('Protocol 2.B: Gemini Response Sanitization', () => {
    test('sanitizes markdown code block ticks (```json ... ```) from Gemini response without SyntaxError', async () => {
      const markdownWrappedResponse = '```json\n{\n  "findings": [\n    {\n      "line": 15,\n      "severity": "CRITICAL",\n      "category": "SECURITY",\n      "title": "SQL Injection in User Query",\n      "explanation": "Raw input concatenated into SQL string.",\n      "diff_before": "query = user_input",\n      "diff_after": "query = sanitize(user_input)"\n    }\n  ]\n}\n```';

      const mockClient = {
        models: {
          generateContent: jest.fn().mockResolvedValue({
            text: () => markdownWrappedResponse,
          }),
        },
      };

      const result = await reviewCodeWithGemini({
        filePath: 'auth.js',
        codeContent: 'const query = "SELECT * FROM users WHERE id = " + userId;',
        language: 'javascript',
        client: mockClient,
      });

      expect(result.partialMode).toBe(false);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].severity).toBe('CRITICAL');
      expect(result.findings[0].category).toBe('SECURITY');
      expect(result.findings[0].title).toBe('SQL Injection in User Query');
    });

    test('falls back gracefully to partial mode when AI response is completely non-JSON', async () => {
      const invalidTextResponse = 'I cannot process this code because it is invalid.';

      const mockClient = {
        models: {
          generateContent: jest.fn().mockResolvedValue({
            text: () => invalidTextResponse,
          }),
        },
      };

      const result = await reviewCodeWithGemini({
        filePath: 'test.js',
        codeContent: 'console.log("hello");',
        language: 'javascript',
        client: mockClient,
      });

      expect(result.partialMode).toBe(true);
      expect(result.reason).toBe('MALFORMED_AI_RESPONSE');
      expect(result.findings).toHaveLength(0);
    });
  });

  // ==========================================================================
  // PROTOCOL 2.C: Normalizer & Scoring Engine Edge Cases
  // ==========================================================================
  describe('Protocol 2.C: Normalizer & Scoring Engine Integrity', () => {
    test('findingsNormalizer merges static and AI findings without duplicate keys', () => {
      const staticFindings = [
        {
          file: 'user.js',
          line: 10,
          severity: 'CRITICAL',
          category: 'SECURITY',
          ruleId: 'SQL_INJECTION',
          title: 'SQL Injection Vulnerability',
          evidence: 'SELECT * FROM users + id',
          source: 'STATIC',
        },
      ];

      const aiFindings = [
        {
          file: 'user.js',
          line: 10,
          severity: 'CRITICAL',
          category: 'SECURITY',
          ruleId: 'AI_SECURITY',
          title: 'SQL Injection in Database Query',
          explanation: 'Use prepared statement parameters.',
          diff_before: 'SELECT * FROM users + id',
          diff_after: 'SELECT * FROM users WHERE id = $1',
          source: 'GEMINI',
        },
        // Duplicate AI finding on same line/title
        {
          file: 'user.js',
          line: 10,
          severity: 'CRITICAL',
          category: 'SECURITY',
          ruleId: 'AI_SECURITY',
          title: 'SQL Injection in Database Query',
          explanation: 'Use prepared statement parameters.',
          diff_before: 'SELECT * FROM users + id',
          diff_after: 'SELECT * FROM users WHERE id = $1',
          source: 'GEMINI',
        },
      ];

      const merged = mergeAndDeduplicate(staticFindings, aiFindings, { filePath: 'user.js' });

      // Overlapping finding must become 1 HYBRID finding without duplicates
      expect(merged).toHaveLength(1);
      expect(merged[0].source).toBe('HYBRID');
      expect(merged[0].line).toBe(10);
    });

    test('scoringEngine: 0 findings = 100 score and Grade A+', () => {
      const result = calculateScore([], 500, 5);

      expect(result.healthScore).toBe(100);
      expect(result.grade).toBe('A+');
      expect(result.totalDeductions).toBe(0);
      expect(result.categoryScores.securityHealth).toBe(100);
      expect(result.categoryScores.bugsHealth).toBe(100);
    });

    test('scoringEngine: high defect count clamps at minimum 0 and Grade F', () => {
      // 10 critical issues = 10 * 20 = 200 deductions
      const criticalFindings = Array.from({ length: 10 }, (_, i) => ({
        severity: 'CRITICAL',
        category: 'SECURITY',
        ruleId: 'SQL_INJECTION',
        line: i + 1,
      }));

      const result = calculateScore(criticalFindings, 100, 1);

      expect(result.healthScore).toBe(0);
      expect(result.grade).toBe('F');
      expect(result.totalDeductions).toBe(200);
      expect(result.categoryScores.securityHealth).toBe(0);
    });

    test('scoringEngine: never outputs NaN when given NaN, null, or undefined numeric inputs', () => {
      const result = calculateScore({
        findings: [{ severity: 'MEDIUM', category: 'QUALITY', line: 1 }],
        totalLines: NaN,
        filesCount: undefined,
      });

      expect(Number.isNaN(result.healthScore)).toBe(false);
      expect(typeof result.healthScore).toBe('number');
      expect(Number.isNaN(result.metrics.totalLines)).toBe(false);
      expect(Number.isNaN(result.metrics.filesCount)).toBe(false);
      expect(Number.isNaN(result.categoryScores.bugsHealth)).toBe(false);
      expect(Number.isNaN(result.categoryScores.securityHealth)).toBe(false);
      expect(Number.isNaN(result.categoryScores.qualityHealth)).toBe(false);
      expect(Number.isNaN(result.categoryScores.optimizationHealth)).toBe(false);
    });
  });
});
