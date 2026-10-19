const {
  analyzeFile,
  analyzeFiles,
  resolveLanguage,
  RULES,
  generateStaticRemediationDiff,
} = require('../src/services/analysis/staticAnalyzer');

describe('Module 7: Static AST Code Analyzer (staticAnalyzer.js)', () => {
  // ============================================================================
  // SUITE 1: Language Resolution & Schema Validation
  // ============================================================================
  describe('Language Resolution and Rule Registry', () => {
    it('should correctly resolve supported programming languages by file extension', () => {
      expect(resolveLanguage('server.js')).toBe('javascript');
      expect(resolveLanguage('app.jsx')).toBe('javascript');
      expect(resolveLanguage('types.ts')).toBe('typescript');
      expect(resolveLanguage('Component.tsx')).toBe('typescript');
      expect(resolveLanguage('main.py')).toBe('python');
      expect(resolveLanguage('Service.java')).toBe('java');
      expect(resolveLanguage('engine.cpp')).toBe('cpp');
      expect(resolveLanguage('header.hpp')).toBe('cpp');
      expect(resolveLanguage('unknown.xyz')).toBe('javascript'); // default fallback
    });

    it('should prioritize explicit language parameter over file extension', () => {
      expect(resolveLanguage('code.txt', 'python')).toBe('python');
      expect(resolveLanguage('snippet', 'typescript')).toBe('typescript');
      expect(resolveLanguage('index.js', 'ts')).toBe('typescript');
    });

    it('should verify rule registry schema and CWE mapping integrity', () => {
      expect(RULES.PARSER_ERROR).toMatchObject({
        ruleId: 'PARSER_ERROR',
        severity: 'HIGH',
        category: 'SYNTAX',
      });
      expect(RULES.SQL_INJECTION).toMatchObject({
        ruleId: 'SQL_INJECTION',
        severity: 'CRITICAL',
        category: 'SECURITY',
        cwe: 'CWE-89',
      });
      expect(RULES.HARDCODED_SECRET).toMatchObject({
        ruleId: 'HARDCODED_SECRET',
        severity: 'CRITICAL',
        category: 'SECURITY',
        cwe: 'CWE-798',
      });
      expect(RULES.EMPTY_CATCH_BLOCK).toMatchObject({
        ruleId: 'EMPTY_CATCH_BLOCK',
        severity: 'MEDIUM',
        category: 'QUALITY',
      });
      expect(RULES.UNUSED_VARIABLE).toMatchObject({
        ruleId: 'UNUSED_VARIABLE',
        severity: 'LOW',
        category: 'QUALITY',
      });
      expect(RULES.CONSOLE_LOG_STMT).toMatchObject({
        ruleId: 'CONSOLE_LOG_STMT',
        severity: 'LOW',
        category: 'QUALITY',
      });
    });

    it('should return empty findings for empty strings or invalid inputs', () => {
      expect(analyzeFile('empty.js', '')).toEqual([]);
      expect(analyzeFile('spaces.js', '   \n  \t  ')).toEqual([]);
      expect(analyzeFile('null.js', null)).toEqual([]);
      expect(analyzeFile('undefined.js', undefined)).toEqual([]);
    });
  });

  // ============================================================================
  // SUITE 2: Valid Clean Code Snippets (Zero Findings)
  // ============================================================================
  describe('Valid and Secure Code Snippets (Clean Passes)', () => {
    it('should report zero findings for clean, secure JavaScript arithmetic utility', () => {
      const code = `
        function calculateDiscount(price, percentage) {
          const discount = price * (percentage / 100);
          return price - discount;
        }
        module.exports = { calculateDiscount };
      `;
      const findings = analyzeFile('src/discount.js', code, 'javascript');
      expect(findings).toEqual([]);
    });

    it('should report zero findings for parameterized SQL database queries', () => {
      const code = `
        const db = require('../db');
        async function getUserById(userId) {
          const result = await db.query('SELECT id, email, full_name FROM users WHERE id = $1', [userId]);
          return result.rows[0];
        }
        module.exports = { getUserById };
      `;
      const findings = analyzeFile('src/services/userService.js', code, 'javascript');
      expect(findings).toEqual([]);
    });

    it('should report zero findings when secrets are safely loaded from environment variables', () => {
      const code = `
        const apiKey = process.env.GEMINI_API_KEY;
        const jwtSecret = process.env.JWT_SECRET || 'dev_fallback';
        function getHeaders() {
          return { Authorization: 'Bearer ' + apiKey };
        }
        module.exports = { getHeaders, jwtSecret };
      `;
      const findings = analyzeFile('src/config/keys.js', code, 'javascript');
      // No hardcoded secrets because apiKey comes from process.env and fallback is <= 12 but not assigned to matching id directly without env check
      const secretFindings = findings.filter((f) => f.ruleId === 'HARDCODED_SECRET');
      expect(secretFindings).toHaveLength(0);
    });

    it('should report zero findings for properly typed TypeScript interfaces and functions', () => {
      const tsCode = `
        interface UserSession {
          id: string;
          tokenExpiry: number;
        }

        export function isValidSession(session: UserSession): boolean {
          return session.tokenExpiry > Date.now();
        }
      `;
      const findings = analyzeFile('src/auth/session.ts', tsCode, 'typescript');
      expect(findings).toEqual([]);
    });

    it('should report zero findings for valid React JSX component with handled events', () => {
      const jsxCode = `
        import React, { useState } from 'react';

        export function Counter() {
          const [count, setCount] = useState(0);
          return (
            <button id="counter-btn" onClick={() => setCount(count + 1)}>
              Count: {count}
            </button>
          );
        }
      `;
      const findings = analyzeFile('src/components/Counter.jsx', jsxCode, 'javascript');
      expect(findings).toEqual([]);
    });

    it('should report zero findings when catch block contains proper error handling', () => {
      const code = `
        const logger = require('./logger');
        function parseJson(str) {
          try {
            return JSON.parse(str);
          } catch (err) {
            logger.error('Failed to parse JSON string:', err.message);
            return null;
          }
        }
        module.exports = { parseJson };
      `;
      const findings = analyzeFile('src/utils/parser.js', code, 'javascript');
      expect(findings).toEqual([]);
    });
  });

  // ============================================================================
  // SUITE 3: Broken Syntax & Parser Exceptions
  // ============================================================================
  describe('Broken Snippets (Syntax / Parser Exceptions)', () => {
    it('should capture syntax error location and return standardized PARSER_ERROR finding', () => {
      const brokenSnippet = `function calculateTotal(price, tax { return price + tax; }`;
      const findings = analyzeFile('src/broken.js', brokenSnippet, 'javascript');

      expect(findings).toHaveLength(1);
      const issue = findings[0];

      expect(issue).toMatchObject({
        file: 'src/broken.js',
        line: 1,
        severity: 'HIGH',
        category: 'SYNTAX',
        ruleId: 'PARSER_ERROR',
        title: 'Syntax Error in Source Code',
        source: 'STATIC',
      });
      expect(issue.description).toContain('Unexpected token');
      expect(issue.evidence).toBe('function calculateTotal(price, tax { return price + tax; }');
      expect(issue).toHaveProperty('column');
    });

    it('should accurately locate syntax error on multiline source code', () => {
      const multilineBroken = [
        'const a = 10;',
        'const b = 20;',
        'const c = (a + b;', // Missing closing parenthesis on line 3
        'console.log(c);',
      ].join('\n');

      const findings = analyzeFile('src/multilineError.js', multilineBroken, 'javascript');

      expect(findings).toHaveLength(1);
      expect(findings[0].line).toBe(3);
      expect(findings[0].ruleId).toBe('PARSER_ERROR');
      expect(findings[0].category).toBe('SYNTAX');
      expect(findings[0].severity).toBe('HIGH');
      expect(findings[0].evidence).toBe('const c = (a + b;');
    });
  });

  // ============================================================================
  // SUITE 4: Vulnerability - SQL Injection (CWE-89)
  // ============================================================================
  describe('Security Vulnerability: SQL Injection (CWE-89)', () => {
    it('should detect BinaryExpression concatenating string with identifier inside db.query()', () => {
      const vulnCode = `
        const db = require('../db');
        function findUser(userId) {
          return db.query("SELECT * FROM users WHERE id = " + userId);
        }
        module.exports = { findUser };
      `;
      const findings = analyzeFile('src/repo/userRepo.js', vulnCode, 'javascript');

      const sqlIssues = findings.filter((f) => f.ruleId === 'SQL_INJECTION');
      expect(sqlIssues.length).toBeGreaterThanOrEqual(1);

      const issue = sqlIssues[0];
      expect(issue).toMatchObject({
        file: 'src/repo/userRepo.js',
        line: 4,
        severity: 'CRITICAL',
        category: 'SECURITY',
        ruleId: 'SQL_INJECTION',
        title: 'SQL Injection Vulnerability (CWE-89)',
        source: 'STATIC',
      });
      expect(issue.description).toContain('Direct string concatenation');
      expect(issue.evidence).toContain('db.query("SELECT * FROM users WHERE id = " + userId)');
    });

    it('should detect chained concatenation inside pool.execute() query execution calls', () => {
      const chainedCode = `
        const pool = require('./pool');
        function insertLog(type, message) {
          pool.execute("INSERT INTO logs (type, msg) VALUES ('" + type + "', '" + message + "')");
        }
        module.exports = { insertLog };
      `;
      const findings = analyzeFile('src/logger.js', chainedCode, 'javascript');

      const sqlIssues = findings.filter((f) => f.ruleId === 'SQL_INJECTION');
      expect(sqlIssues.length).toBeGreaterThanOrEqual(1);
      expect(sqlIssues[0].severity).toBe('CRITICAL');
      expect(sqlIssues[0].category).toBe('SECURITY');
      expect(sqlIssues[0].line).toBe(4);
    });

    it('should detect untagged template literal interpolation inside client.query() calls', () => {
      const templateLiteralQuery = `
        const client = require('./client');
        async function getOrder(orderId) {
          return client.query(\`SELECT * FROM orders WHERE order_id = \${orderId}\`);
        }
        module.exports = { getOrder };
      `;
      const findings = analyzeFile('src/orders.js', templateLiteralQuery, 'javascript');

      const sqlIssues = findings.filter((f) => f.ruleId === 'SQL_INJECTION');
      expect(sqlIssues.length).toBeGreaterThanOrEqual(1);
      expect(sqlIssues[0].ruleId).toBe('SQL_INJECTION');
      expect(sqlIssues[0].severity).toBe('CRITICAL');
      expect(sqlIssues[0].line).toBe(4);
    });

    it('should detect standalone dynamic SQL concatenation assigned to variable', () => {
      const queryBuildCode = `
        function buildQuery(tableName, filter) {
          const sql = "SELECT * FROM " + tableName + " WHERE status = 'active'";
          return sql;
        }
        module.exports = { buildQuery };
      `;
      const findings = analyzeFile('src/queryBuilder.js', queryBuildCode, 'javascript');

      const sqlIssues = findings.filter((f) => f.ruleId === 'SQL_INJECTION');
      expect(sqlIssues.length).toBeGreaterThanOrEqual(1);
      expect(sqlIssues[0].line).toBe(3);
    });
  });

  // ============================================================================
  // SUITE 5: Vulnerability - Hardcoded Secrets (CWE-798)
  // ============================================================================
  describe('Security Vulnerability: Hardcoded Secrets (CWE-798)', () => {
    it('should detect hardcoded API keys matching /token|secret|jwt|api_key/i (> 8 chars)', () => {
      const code = `
        const api_key = "sk_live_1234567890abcdef";
        module.exports = { api_key };
      `;
      const findings = analyzeFile('src/config.js', code, 'javascript');

      const secretIssues = findings.filter((f) => f.ruleId === 'HARDCODED_SECRET');
      expect(secretIssues).toHaveLength(1);

      const issue = secretIssues[0];
      expect(issue).toMatchObject({
        file: 'src/config.js',
        line: 2,
        severity: 'CRITICAL',
        category: 'SECURITY',
        ruleId: 'HARDCODED_SECRET',
        title: 'Hardcoded Credential / Secret (CWE-798)',
        source: 'STATIC',
      });
      expect(issue.description).toContain('api_key');
      expect(issue.evidence).toBe('const api_key = "sk_live_1234567890abcdef";');
    });

    it('should detect hardcoded JWT tokens in variable declarations', () => {
      const code = `
        const jwt_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlNoaXZhbSJ9.dummy_signature";
        module.exports = { jwt_token };
      `;
      const findings = analyzeFile('src/auth.js', code, 'javascript');

      const secretIssues = findings.filter((f) => f.ruleId === 'HARDCODED_SECRET');
      expect(secretIssues).toHaveLength(1);
      expect(secretIssues[0].line).toBe(2);
      expect(secretIssues[0].severity).toBe('CRITICAL');
    });

    it('should detect hardcoded secrets in AssignmentExpressions and ObjectProperties', () => {
      const code = `
        const config = {};
        config.client_secret = "super_confidential_client_secret_998877";
        const authPayload = {
          apiKey: "sk_test_51Mz000000000000000000000",
        };
        module.exports = { config, authPayload };
      `;
      const findings = analyzeFile('src/authConfig.js', code, 'javascript');

      const secretIssues = findings.filter((f) => f.ruleId === 'HARDCODED_SECRET');
      expect(secretIssues).toHaveLength(2);
      expect(secretIssues.map((s) => s.line)).toEqual([3, 5]);
    });

    it('should NOT flag short string literals (<= 8 characters)', () => {
      const code = `
        const api_key = "12345678"; // Exactly 8 characters
        const token = "short";
        module.exports = { api_key, token };
      `;
      const findings = analyzeFile('src/short.js', code, 'javascript');
      const secretIssues = findings.filter((f) => f.ruleId === 'HARDCODED_SECRET');
      expect(secretIssues).toHaveLength(0);
    });

    it('should NOT flag identifiers that do not match the secret pattern', () => {
      const code = `
        const username = "shivam_vishwakarma_dev";
        const repositoryName = "recode-automated-review-platform";
        module.exports = { username, repositoryName };
      `;
      const findings = analyzeFile('src/names.js', code, 'javascript');
      const secretIssues = findings.filter((f) => f.ruleId === 'HARDCODED_SECRET');
      expect(secretIssues).toHaveLength(0);
    });
  });

  // ============================================================================
  // SUITE 6: Code Quality Issues (Unused Variables, Empty Catch, Console.log)
  // ============================================================================
  describe('Code Quality Inspections', () => {
    it('should detect unused variable declarations', () => {
      const code = `
        function calculateArea(width, height) {
          const unusedMultiplier = 1.5;
          return width * height;
        }
        module.exports = { calculateArea };
      `;
      const findings = analyzeFile('src/geometry.js', code, 'javascript');

      const unusedIssues = findings.filter((f) => f.ruleId === 'UNUSED_VARIABLE');
      expect(unusedIssues).toHaveLength(1);
      expect(unusedIssues[0]).toMatchObject({
        file: 'src/geometry.js',
        line: 3,
        severity: 'LOW',
        category: 'QUALITY',
        ruleId: 'UNUSED_VARIABLE',
        title: 'Unused Variable Declaration',
        source: 'STATIC',
      });
      expect(unusedIssues[0].description).toContain('unusedMultiplier');
    });

    it('should ignore intentionally unused variables prefixed with underscore (_req, _next)', () => {
      const code = `
        function authMiddleware(_req, res, next) {
          const _debugContext = { timestamp: Date.now() };
          return next();
        }
        module.exports = { authMiddleware };
      `;
      const findings = analyzeFile('src/middleware.js', code, 'javascript');
      const unusedIssues = findings.filter((f) => f.ruleId === 'UNUSED_VARIABLE');
      expect(unusedIssues).toHaveLength(0);
    });

    it('should detect empty catch blocks', () => {
      const code = `
        function runTask() {
          try {
            JSON.parse('invalid json');
          } catch (e) {
          }
        }
        module.exports = { runTask };
      `;
      const findings = analyzeFile('src/task.js', code, 'javascript');

      const catchIssues = findings.filter((f) => f.ruleId === 'EMPTY_CATCH_BLOCK');
      expect(catchIssues).toHaveLength(1);
      expect(catchIssues[0]).toMatchObject({
        file: 'src/task.js',
        line: 5,
        severity: 'MEDIUM',
        category: 'QUALITY',
        ruleId: 'EMPTY_CATCH_BLOCK',
        title: 'Empty Catch Block',
        source: 'STATIC',
      });
      expect(catchIssues[0].description).toContain('Unhandled exceptions should be logged');
    });

    it('should detect direct console.log statements left in production code paths', () => {
      const code = `
        function processPayment(paymentId) {
          console.log("Processing payment with ID:", paymentId);
          return { status: 'success', paymentId };
        }
        module.exports = { processPayment };
      `;
      const findings = analyzeFile('src/payments.js', code, 'javascript');

      const logIssues = findings.filter((f) => f.ruleId === 'CONSOLE_LOG_STMT');
      expect(logIssues).toHaveLength(1);
      expect(logIssues[0]).toMatchObject({
        file: 'src/payments.js',
        line: 3,
        severity: 'LOW',
        category: 'QUALITY',
        ruleId: 'CONSOLE_LOG_STMT',
        title: 'Console Log Left in Production Code',
        source: 'STATIC',
      });
      expect(logIssues[0].description).toContain('structured logger');
    });
  });

  // ============================================================================
  // SUITE 7: Comprehensive Multi-Issue Codebase File
  // ============================================================================
  describe('Comprehensive Multi-Issue File Inspection', () => {
    it('should detect all distinct security vulnerabilities and code quality smells in a single file', () => {
      const dirtyFile = [
        'const db = require("./db");',
        'const api_key = "sk_live_998877665544332211";', // Line 2: HARDCODED_SECRET
        'function handleUserRequest(userId) {',
        '  const temporaryCounter = 0;', // Line 4: UNUSED_VARIABLE
        '  console.log("Starting lookup for user:", userId);', // Line 5: CONSOLE_LOG_STMT
        '  try {',
        '    return db.query("SELECT * FROM profiles WHERE id = " + userId);', // Line 7: SQL_INJECTION
        '  } catch (err) {', // Line 8: EMPTY_CATCH_BLOCK
        '  }',
        '}',
        'module.exports = { handleUserRequest, api_key };',
      ].join('\n');

      const findings = analyzeFile('src/controllers/userController.js', dirtyFile, 'javascript');

      expect(findings).toHaveLength(5);

      // Verify findings are sorted in ascending line order
      for (let i = 0; i < findings.length - 1; i++) {
        expect(findings[i].line).toBeLessThanOrEqual(findings[i + 1].line);
      }

      // Check rule IDs
      const ruleIds = findings.map((f) => f.ruleId);
      expect(ruleIds).toContain('HARDCODED_SECRET');
      expect(ruleIds).toContain('UNUSED_VARIABLE');
      expect(ruleIds).toContain('CONSOLE_LOG_STMT');
      expect(ruleIds).toContain('SQL_INJECTION');
      expect(ruleIds).toContain('EMPTY_CATCH_BLOCK');

      // Verify all items conform to the standardized output format
      for (const item of findings) {
        expect(item).toHaveProperty('file', 'src/controllers/userController.js');
        expect(typeof item.line).toBe('number');
        expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']).toContain(item.severity);
        expect(['SYNTAX', 'SECURITY', 'QUALITY', 'OPTIMIZATION']).toContain(item.category);
        expect(typeof item.ruleId).toBe('string');
        expect(typeof item.title).toBe('string');
        expect(typeof item.description).toBe('string');
        expect(typeof item.evidence).toBe('string');
        expect(item.source).toBe('STATIC');
      }
    });
  });

  // ============================================================================
  // SUITE 8: Batch Files Analysis (analyzeFiles)
  // ============================================================================
  describe('Batch Multi-File Analysis (analyzeFiles)', () => {
    it('should aggregate findings across multiple files from repository ingestion', () => {
      const files = [
        {
          path: 'src/clean.js',
          language: 'javascript',
          content: 'function ok() { return true; } module.exports = { ok };',
        },
        {
          path: 'src/vuln.js',
          language: 'javascript',
          content: 'const jwt_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."; module.exports = { jwt_token };',
        },
        {
          path: 'src/syntax.js',
          language: 'javascript',
          content: 'const x = { broken',
        },
      ];

      const aggregated = analyzeFiles(files);

      expect(aggregated).toHaveLength(2); // 1 secret in vuln.js, 1 parser error in syntax.js
      expect(aggregated.some((f) => f.file === 'src/vuln.js' && f.ruleId === 'HARDCODED_SECRET')).toBe(true);
      expect(aggregated.some((f) => f.file === 'src/syntax.js' && f.ruleId === 'PARSER_ERROR')).toBe(true);
    });

    it('should return empty array when given an empty or invalid files array', () => {
      expect(analyzeFiles([])).toEqual([]);
      expect(analyzeFiles(null)).toEqual([]);
      expect(analyzeFiles(undefined)).toEqual([]);
    });
  });

  // ============================================================================
  // SUITE 9: Non-JavaScript Language Fallback Support (Python, Java, C++)
  // ============================================================================
  describe('Non-JavaScript Languages Support (Python, Java, C++)', () => {
    it('should detect SQL injection and hardcoded secret in Python code', () => {
      const pythonSnippet = `
import os

api_key = "sk_live_1234567890abcdef"

def query_user(cursor, user_id):
    cursor.execute("SELECT * FROM users WHERE id = " + user_id)
`;
      const findings = analyzeFile('app/service.py', pythonSnippet, 'python');

      expect(findings.some((f) => f.ruleId === 'HARDCODED_SECRET')).toBe(true);
      expect(findings.some((f) => f.ruleId === 'SQL_INJECTION')).toBe(true);
    });

    it('should detect empty except block in Python code', () => {
      const pythonCatch = `
def parse_data(raw):
    try:
        val = int(raw)
    except:
        pass
    return val
`;
      const findings = analyzeFile('app/parser.py', pythonCatch, 'python');
      expect(findings.some((f) => f.ruleId === 'EMPTY_CATCH_BLOCK')).toBe(true);
    });

    it('should detect hardcoded secret in Java source code', () => {
      const javaSnippet = `
public class Config {
    private static final String secret = "super_secret_database_pass_123";
}
`;
      const findings = analyzeFile('src/Config.java', javaSnippet, 'java');
      expect(findings.some((f) => f.ruleId === 'HARDCODED_SECRET')).toBe(true);
    });
  });

  // ============================================================================
  // SUITE 10: SQL Analysis Engine, Dynamic Concat, Cartesian Joins & Remediations
  // ============================================================================
  describe('SQL Analysis Engine & Remediation Output', () => {
    it('should generate concrete SQL fixes for UNRESTRICTED_MUTATION without generic placeholders', () => {
      // 1. UPDATE table SET ...
      const updateGeneric = generateStaticRemediationDiff('UNRESTRICTED_MUTATION', 'UPDATE table SET ...', 'sql');
      expect(updateGeneric).toBe('UPDATE table SET ... WHERE id = :target_id;');
      expect(updateGeneric).not.toContain('// Refactored safe code block');
      expect(updateGeneric).not.toContain('//');

      // 2. DELETE FROM table
      const deleteGeneric = generateStaticRemediationDiff('UNRESTRICTED_MUTATION', 'DELETE FROM table', 'sql');
      expect(deleteGeneric).toBe('DELETE FROM table WHERE id = :target_id;');
      expect(deleteGeneric).not.toContain('// Refactored safe code block');
      expect(deleteGeneric).not.toContain('//');

      // 3. Concrete UPDATE with SET clause
      const updateSpecific = generateStaticRemediationDiff('UNRESTRICTED_MUTATION', "UPDATE users SET status = 'inactive';", 'sql');
      expect(updateSpecific).toBe("UPDATE users SET status = 'inactive' WHERE id = :target_id;");
      expect(updateSpecific).not.toContain('//');

      // 4. Concrete DELETE FROM clause
      const deleteSpecific = generateStaticRemediationDiff('UNRESTRICTED_MUTATION', 'DELETE FROM orders;', 'sql');
      expect(deleteSpecific).toBe('DELETE FROM orders WHERE id = :target_id;');
      expect(deleteSpecific).not.toContain('//');
    });

    it('should detect UNRESTRICTED_MUTATION on UPDATE and DELETE statements without WHERE clauses', () => {
      const sqlSnippet = `
UPDATE users SET status = 'active';
DELETE FROM audit_logs;
UPDATE accounts SET balance = 100 WHERE id = 1;
DELETE FROM orders WHERE status = 'cancelled';
`;
      const findings = analyzeFile('schema/mutations.sql', sqlSnippet, 'sql');
      const mutationFindings = findings.filter((f) => f.ruleId === 'UNRESTRICTED_MUTATION');

      expect(mutationFindings.length).toBe(2);
      expect(mutationFindings[0].line).toBe(2);
      expect(mutationFindings[1].line).toBe(3);
      expect(mutationFindings[0].diff_after).toBe("UPDATE users SET status = 'active' WHERE id = :target_id;");
      expect(mutationFindings[1].diff_after).toBe('DELETE FROM audit_logs WHERE id = :target_id;');
    });

    it('should detect dynamic SQL concatenation (e.g. CUST_ + @dynamicInput) as high-risk CWE-89', () => {
      const dynamicSql = `
SELECT * FROM customers WHERE code = 'CUST_' + @dynamicInput;
`;
      const findings = analyzeFile('queries/customerQuery.sql', dynamicSql, 'sql');
      const sqlInjectionFinding = findings.find((f) => f.ruleId === 'SQL_INJECTION');

      expect(sqlInjectionFinding).toBeDefined();
      expect(sqlInjectionFinding.severity).toBe('HIGH');
      expect(sqlInjectionFinding.category).toBe('SECURITY');
      expect(sqlInjectionFinding.description).toContain('CWE-89');
      expect(sqlInjectionFinding.description).toContain('parameterized');
      expect(sqlInjectionFinding.diff_after).toContain(':target_param');
      expect(sqlInjectionFinding.diff_after).not.toContain('//');
      expect(sqlInjectionFinding.diff_after).toContain('--');
    });

    it('should detect implicit comma joins as unintended Cartesian products', () => {
      const cartesianSql = `
SELECT * FROM orders o, customers c, products p;
`;
      const findings = analyzeFile('reports/salesReport.sql', cartesianSql, 'sql');
      const cartesianFinding = findings.find((f) => f.ruleId === 'IMPLICIT_CARTESIAN_JOIN');

      expect(cartesianFinding).toBeDefined();
      expect(cartesianFinding.severity).toBe('HIGH');
      expect(cartesianFinding.category).toBe('OPTIMIZATION');
      expect(cartesianFinding.title).toContain('Cartesian Product');
      expect(cartesianFinding.diff_after).toContain('-- Replace implicit comma join');
      expect(cartesianFinding.diff_after).not.toContain('//');
    });

    it('should NOT flag legitimate explicit JOINs or comma joins with proper equality conditions', () => {
      const cleanSql = `
SELECT * FROM orders o INNER JOIN customers c ON o.customer_id = c.id;
SELECT o.id, c.name FROM orders o, customers c WHERE o.customer_id = c.id;
`;
      const findings = analyzeFile('queries/cleanJoins.sql', cleanSql, 'sql');
      const cartesianFindings = findings.filter((f) => f.ruleId === 'IMPLICIT_CARTESIAN_JOIN');

      expect(cartesianFindings.length).toBe(0);
    });

    it('should ensure all SQL remediation snippets strictly use SQL comment syntax (--) and never (//)', () => {
      const rules = [
        'UNRESTRICTED_MUTATION',
        'IMPLICIT_CARTESIAN_JOIN',
        'SQL_INJECTION',
        'SQL_LEADING_WILDCARD',
        'UNUSED_VARIABLE',
        'HARDCODED_SECRET',
        'CONSOLE_LOG_STMT',
        'PARSER_ERROR',
      ];

      for (const rule of rules) {
        const remediation = generateStaticRemediationDiff(rule, "SELECT * FROM users WHERE code = 'test';", 'sql');
        expect(remediation).not.toContain('//');
        expect(remediation).not.toContain('// Refactored safe code block');
      }
    });
  });
});
