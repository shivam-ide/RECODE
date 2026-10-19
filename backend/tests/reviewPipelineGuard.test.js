const {
  validateSyntaxGuard,
  analyzeFile,
  analyzeJavaScriptAst,
} = require('../src/services/analysis/staticAnalyzer');
const {
  mergeAndDeduplicate,
} = require('../src/services/analysis/findingsNormalizer');
const {
  buildReviewPrompt,
  RECODE_SYSTEM_INSTRUCTION,
  FINDINGS_JSON_SCHEMA,
} = require('../src/services/ai/geminiClient');
const { executeReviewPipeline } = require('../src/services/orchestrator');

describe('Rigorous Review and Error-Checking Pipeline Guard Tests', () => {
  // ============================================================================
  // STAGE 1: Syntax & Parsing Guard
  // ============================================================================
  describe('Stage 1: Syntax & Parsing Guard', () => {
    it('should detect pure SQL submitted under a JavaScript file and halt false vulnerability alerts', () => {
      const pureSqlCode = "SELECT * FROM users WHERE id = 1 OR '1'='1';";
      const syntaxGuard = validateSyntaxGuard('app.js', pureSqlCode, 'javascript');

      expect(syntaxGuard.hasError).toBe(true);
      expect(syntaxGuard.diagnostic).toBeDefined();
      expect(syntaxGuard.diagnostic.ruleId).toBe('PARSER_ERROR');
      expect(syntaxGuard.diagnostic.category).toBe('SYNTAX');
      expect(syntaxGuard.diagnostic.description).toContain('Language mismatch');
      expect(syntaxGuard.diagnostic.description).toContain('SQL statements submitted under JavaScript/TypeScript file');

      // Run full static analysis on the file
      const analysisFindings = analyzeFile('app.js', pureSqlCode, 'javascript');

      // MUST only have the 1 syntax error finding and ZERO false SQL injection alerts
      expect(analysisFindings).toHaveLength(1);
      expect(analysisFindings[0].ruleId).toBe('PARSER_ERROR');

      const falseSqlAlerts = analysisFindings.filter((f) => f.ruleId === 'SQL_INJECTION');
      expect(falseSqlAlerts).toHaveLength(0);
    });

    it('should detect broken JavaScript syntax and return precise line and column diagnostics', () => {
      const brokenJs = 'function calculateTotal(items {\n  return 42;\n}';
      const syntaxGuard = validateSyntaxGuard('calc.js', brokenJs, 'javascript');

      expect(syntaxGuard.hasError).toBe(true);
      expect(syntaxGuard.diagnostic.line).toBe(1);
      expect(syntaxGuard.diagnostic.column).toBeGreaterThanOrEqual(1);

      const analysisFindings = analyzeFile('calc.js', brokenJs, 'javascript');
      expect(analysisFindings).toHaveLength(1);
      expect(analysisFindings[0].ruleId).toBe('PARSER_ERROR');
    });

    it('should pass valid JavaScript without syntax errors', () => {
      const validJs = 'function hello(name) { return `Hello, ${name}!`; }';
      const syntaxGuard = validateSyntaxGuard('hello.js', validJs, 'javascript');

      expect(syntaxGuard.hasError).toBe(false);
      expect(syntaxGuard.diagnostic).toBeNull();
    });

    it('should pass valid SQL submitted under sql language', () => {
      const validSql = 'SELECT id, email, created_at FROM users WHERE status = $1 ORDER BY id DESC;';
      const syntaxGuard = validateSyntaxGuard('query.sql', validSql, 'sql');

      expect(syntaxGuard.hasError).toBe(false);
      expect(syntaxGuard.diagnostic).toBeNull();
    });
  });

  // ============================================================================
  // STAGE 2: Static Deterministic Rules
  // ============================================================================
  describe('Stage 2: Static Deterministic Rules', () => {
    it('should detect hardcoded secrets (AWS keys) deterministically', () => {
      const secretCode = 'const awsKey = "AKIAIOSFODNN7EXAMPLE";';
      const findings = analyzeJavaScriptAst('config.js', secretCode);

      const secretFinding = findings.find((f) => f.ruleId === 'HARDCODED_SECRET');
      expect(secretFinding).toBeDefined();
      expect(secretFinding.severity).toBe('CRITICAL');
      expect(secretFinding.cweId).toBe('CWE-798');
      expect(secretFinding.line).toBe(1);
    });

    it('should detect dynamic concatenation SQL injection (CWE-89) in database calls', () => {
      const sqliCode = 'const result = db.query("SELECT * FROM users WHERE id = " + userId);';
      const findings = analyzeJavaScriptAst('repo.js', sqliCode);

      const sqliFinding = findings.find((f) => f.ruleId === 'SQL_INJECTION');
      expect(sqliFinding).toBeDefined();
      expect(sqliFinding.severity).toBe('CRITICAL');
      expect(sqliFinding.cweId).toBe('CWE-89');
      expect(sqliFinding.line).toBe(1);
    });

    it('should detect DOM XSS via innerHTML and document.write', () => {
      const xssCode = [
        'function render(data) {',
        '  document.getElementById("target").innerHTML = data.userInput;',
        '  document.write(data.banner);',
        '}',
      ].join('\n');

      const findings = analyzeJavaScriptAst('ui.js', xssCode);
      const xssFindings = findings.filter((f) => f.ruleId === 'DOM_XSS');

      expect(xssFindings.length).toBeGreaterThanOrEqual(2);
      expect(xssFindings[0].cweId).toBe('CWE-79');
      expect(xssFindings[0].severity).toBe('MEDIUM');
    });

    it('should detect dead unreachable code following return (CWE-561)', () => {
      const deadCode = [
        'function calculate(x) {',
        '  return x * 2;',
        '  const deadVar = 100;',
        '}',
      ].join('\n');

      const findings = analyzeJavaScriptAst('calc.js', deadCode);
      const deadFinding = findings.find((f) => f.ruleId === 'DEAD_CODE');

      expect(deadFinding).toBeDefined();
      expect(deadFinding.severity).toBe('MEDIUM');
      expect(deadFinding.cweId).toBe('CWE-561');
      expect(deadFinding.line).toBe(3);
    });

    it('should detect unhandled async promise chain missing .catch() (CWE-391)', () => {
      const unhandledCode = [
        'function fetchUserData(id) {',
        '  fetch("/api/users/" + id).then(res => res.json());',
        '}',
      ].join('\n');

      const findings = analyzeJavaScriptAst('api.js', unhandledCode);
      const promiseFinding = findings.find((f) => f.ruleId === 'UNHANDLED_ASYNC_PROMISE');

      expect(promiseFinding).toBeDefined();
      expect(promiseFinding.severity).toBe('MEDIUM');
      expect(promiseFinding.cweId).toBe('CWE-391');
      expect(promiseFinding.line).toBe(2);
    });
  });

  // ============================================================================
  // STAGE 3: Structured LLM Review with Grounding
  // ============================================================================
  describe('Stage 3: Structured LLM Review with Grounding', () => {
    it('should include strict anti-hallucination grounding instructions in system prompt', () => {
      expect(RECODE_SYSTEM_INSTRUCTION).toContain('STRICT ANTI-HALLUCINATION & GROUNDING DIRECTIVES:');
      expect(RECODE_SYSTEM_INSTRUCTION).toContain('strictly FORBIDDEN from flagging non-existent issues');
      expect(RECODE_SYSTEM_INSTRUCTION).toContain('vulnerableSnippet');
      expect(RECODE_SYSTEM_INSTRUCTION).toContain('Never hallucinate code that was not submitted');
    });

    it('should define structured JSON Schema with all required fields', () => {
      const itemProps = FINDINGS_JSON_SCHEMA.properties.findings.items.properties;
      expect(itemProps.ruleId).toBeDefined();
      expect(itemProps.severity).toBeDefined();
      expect(itemProps.cweId).toBeDefined();
      expect(itemProps.lineStart).toBeDefined();
      expect(itemProps.lineEnd).toBeDefined();
      expect(itemProps.vulnerableSnippet).toBeDefined();
      expect(itemProps.explanation).toBeDefined();
      expect(itemProps.concreteFix).toBeDefined();
    });

    it('should pass language, raw code, and Stage 2 static findings as grounding context in buildReviewPrompt', () => {
      const prompt = buildReviewPrompt({
        filePath: 'src/auth.js',
        codeContent: 'const key = "123";',
        language: 'javascript',
        staticFindings: [
          {
            ruleId: 'HARDCODED_SECRET',
            line: 1,
            severity: 'CRITICAL',
            title: 'Hardcoded Secret',
          },
        ],
      });

      expect(prompt).toContain('file "src/auth.js" (javascript)');
      expect(prompt).toContain('PRELIMINARY STATIC AST FINDINGS:');
      expect(prompt).toContain('HARDCODED_SECRET');
    });
  });

  // ============================================================================
  // DEDUPLICATION & CROSS-VALIDATION
  // ============================================================================
  describe('Deduplication & Cross-Validation', () => {
    it('should eliminate duplicate reports for the same line of code and merge into HYBRID', () => {
      const staticFindings = [
        {
          file: 'service.js',
          line: 5,
          ruleId: 'SQL_INJECTION',
          cweId: 'CWE-89',
          severity: 'CRITICAL',
          category: 'SECURITY',
          title: 'SQL Injection Vulnerability (CWE-89)',
          source: 'STATIC',
        },
      ];

      const aiFindings = [
        {
          file: 'service.js',
          lineStart: 5,
          ruleId: 'CWE-89',
          severity: 'CRITICAL',
          category: 'SECURITY',
          title: 'SQL Injection in Query',
          vulnerableSnippet: 'db.query("SELECT * FROM users WHERE id = " + id)',
          concreteFix: 'db.query("SELECT * FROM users WHERE id = $1", [id])',
          explanation: 'User input is concatenated into SQL statement.',
          source: 'GEMINI',
        },
      ];

      const codeContent = [
        'function getUser(id) {',
        '  // lookup',
        '  const query = "SELECT * FROM users";',
        '  console.log("finding user");',
        '  db.query("SELECT * FROM users WHERE id = " + id);',
        '}',
      ].join('\n');

      const merged = mergeAndDeduplicate(staticFindings, aiFindings, {
        filePath: 'service.js',
        content: codeContent,
      });

      expect(merged).toHaveLength(1);
      expect(merged[0].engine_source).toBe('HYBRID');
      expect(merged[0].line).toBe(5);
      expect(merged[0].ruleId).toBe('SQL_INJECTION');
      expect(merged[0].cweId).toBe('CWE-89');
    });

    it('should reject hallucinated AI findings where code snippet does not exist in user input', () => {
      const codeContent = [
        'function add(a, b) {',
        '  return a + b;',
        '}',
      ].join('\n');

      const hallucinatedAiFindings = [
        {
          file: 'math.js',
          lineStart: 2,
          ruleId: 'XSS_VULNERABILITY',
          severity: 'HIGH',
          category: 'SECURITY',
          title: 'Cross-Site Scripting',
          vulnerableSnippet: 'document.body.innerHTML = maliciousInput;',
          concreteFix: 'document.body.textContent = maliciousInput;',
          explanation: 'Dangerous DOM sink detected.',
          source: 'GEMINI',
        },
      ];

      const merged = mergeAndDeduplicate([], hallucinatedAiFindings, {
        filePath: 'math.js',
        content: codeContent,
      });

      // Must be completely rejected because document.body.innerHTML is nowhere in the code!
      expect(merged).toHaveLength(0);
    });

    it('should reject AI findings where line number is completely out of bounds and snippet is missing', () => {
      const codeContent = 'const x = 1;\nconst y = 2;';
      const outOfBoundsFinding = [
        {
          file: 'index.js',
          lineStart: 99,
          ruleId: 'QUALITY_ISSUE',
          severity: 'LOW',
          category: 'QUALITY',
          title: 'Unused Variable on Line 99',
          source: 'GEMINI',
        },
      ];

      const merged = mergeAndDeduplicate([], outOfBoundsFinding, {
        filePath: 'index.js',
        content: codeContent,
      });

      expect(merged).toHaveLength(0);
    });
  });

  // ============================================================================
  // DEFENSIVE ERROR HANDLING & UI RESILIENCE
  // ============================================================================
  describe('Defensive Error Handling & UI Resilience', () => {
    it('should halt Gemini review and return clean syntax diagnostic without crashing on syntax guard failure', async () => {
      const result = await executeReviewPipeline({
        sourceType: 'direct',
        content: "SELECT name FROM employees WHERE dept = 'Sales';",
        language: 'javascript',
        projectName: 'SyntaxGuardProject',
      });

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      const findings = result.findings || result.issues;
      expect(findings).toHaveLength(1);
      expect(findings[0].category).toBe('SYNTAX');
      expect(findings[0].ruleId).toBe('PARSER_ERROR');
      expect(findings[0].what_is_wrong || findings[0].description).toContain('Language mismatch');
    });

    it('should throw clean validation error for empty or blank submissions without unhandled crash', async () => {
      await expect(
        executeReviewPipeline({
          sourceType: 'direct',
          content: '   ',
          language: 'javascript',
          projectName: 'EmptyProject',
        })
      ).rejects.toThrow('Code snippet content must be a non-empty string.');
    });
  });
});
