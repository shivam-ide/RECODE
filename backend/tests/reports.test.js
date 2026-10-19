const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const {
  generateReviewPdf,
  normalizePdfCode,
  normalizePdfText,
  getMonospaceFont,
  formatIstTimestamp,
} = require('../src/services/reports/pdfGenerator');
const { generateSuggestedReadme } = require('../src/services/reports/readmeGenerator');
const { saveReviewResult } = require('../src/services/persistence/reviewRepository');
const { supabaseAdmin } = require('../src/config/supabaseClient');

describe('Module 17: Reports & Exports (PDF & README Generation)', () => {
  const createdReviewIds = [];

  afterAll(async () => {
    for (const id of createdReviewIds) {
      try {
        await supabaseAdmin.from('reviews').delete().eq('id', id);
      } catch (e) {
        // Ignore cleanup
      }
    }
  });

  // ============================================================================
  // SUITE 1: PDF Generator Unit Tests
  // ============================================================================
  describe('PDF Generator (generateReviewPdf)', () => {
    it('should generate a valid binary PDF buffer starting with %PDF- for clean project', async () => {
      const reviewData = {
        projectName: 'Clean Architecture Project',
        healthScore: 100,
        grade: 'A+',
        sourceType: 'direct',
        files: [{ path: 'index.js', language: 'javascript', linesCount: 120, issuesCount: 0 }],
        issues: [],
      };

      const buffer = await generateReviewPdf(reviewData);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);
      expect(buffer.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('should generate a comprehensive multi-page PDF containing issues, diff blocks, and categories', async () => {
      const reviewData = {
        projectName: 'Vulnerable Microservice',
        healthScore: 65,
        grade: 'C',
        sourceType: 'github',
        repoUrl: 'https://github.com/org/repo',
        files: [
          { path: 'src/auth.js', language: 'javascript', linesCount: 200, issuesCount: 1 },
          { path: 'src/db.js', language: 'javascript', linesCount: 150, issuesCount: 1 },
        ],
        issues: [
          {
            severity: 'CRITICAL',
            category: 'SECURITY',
            title: 'SQL Injection in User Query',
            ruleId: 'SQL_INJECTION',
            file: 'src/auth.js',
            line: 42,
            description: 'Direct string concatenation in SQL query allows remote statement injection.',
            diff_before: 'db.query("SELECT * FROM users WHERE id = " + id);',
            diff_after: 'db.query("SELECT * FROM users WHERE id = $1", [id]);',
            engine_source: 'HYBRID',
          },
          {
            severity: 'HIGH',
            category: 'SECURITY',
            title: 'Hardcoded Secret Key',
            ruleId: 'HARDCODED_SECRET',
            file: 'src/db.js',
            line: 12,
            description: 'Database credentials stored as static plaintext literal.',
            diff_before: 'const pass = "secret123456";',
            diff_after: 'const pass = process.env.DB_PASS;',
            engine_source: 'STATIC',
          },
        ],
      };

      const buffer = await generateReviewPdf(reviewData);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(3000);
      expect(buffer.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('should normalize and preserve raw code characters (backticks, ${...}, quotes, %, wildcards) without corruption', () => {
      const rawCode = "const query = `SELECT * FROM users WHERE code LIKE '%9812' AND id = ${user.id} AND val = '{test}' AND list = '[1,2]' AND entity = s'`;";
      const sanitized = normalizePdfCode(rawCode);

      expect(sanitized).toContain("'%9812'");
      expect(sanitized).toContain('${user.id}');
      expect(sanitized).toContain("'{test}'");
      expect(sanitized).toContain("'[1,2]'");
      expect(sanitized).toContain("s'");
      expect(sanitized).not.toContain('1498121');
      expect(sanitized).toContain('`SELECT * FROM users');
    });

    it('should decode HTML entities and normalize smart quotes and unicode dashes in code snippets', () => {
      const rawHtmlCode = 'const expr = &quot;SELECT &apos;%9812&apos; FROM &lt;tbl&gt; WHERE a &amp; b&quot;;\nconst smart = ‘single’ and “double” and `backtick`;';
      const sanitized = normalizePdfCode(rawHtmlCode);

      expect(sanitized).toContain('const expr = "SELECT \'%9812\' FROM <tbl> WHERE a & b";');
      expect(sanitized).toContain("const smart = 'single' and \"double\" and `backtick`;");
      expect(sanitized).not.toContain('&quot;');
      expect(sanitized).not.toContain('&apos;');
      expect(sanitized).not.toContain('&lt;');
      expect(sanitized).not.toContain('&gt;');
      expect(sanitized).not.toContain('&amp;');
    });

    it('should normalize special symbols in general PDF text (arrows, checks, quotes)', () => {
      const rawText = '✓ Clean &amp; secure — status: 100% “verified” → ready for deploy';
      const sanitized = normalizePdfText(rawText);

      expect(sanitized).toContain('[OK] Clean & secure - status: 100% "verified" -> ready for deploy');
      expect(sanitized).not.toContain('&amp;');
    });

    it('should resolve a valid monospace font family for code rendering', () => {
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument();
      const font = getMonospaceFont(doc);

      expect(['ReCodeMono', 'Courier']).toContain(font);
    });

    it('should generate a PDF containing complex code with %9812, backticks, template literals, and long lines without crashing', async () => {
      const reviewData = {
        projectName: 'Encoding & Layout Edge Case Audit',
        healthScore: 75,
        grade: 'B',
        sourceType: 'direct',
        files: [{ path: 'edgeCases.js', language: 'javascript', linesCount: 100, issuesCount: 1 }],
        issues: [
          {
            severity: 'CRITICAL',
            category: 'SECURITY',
            title: 'Dynamic SQL with %9812 and Template Literals',
            ruleId: 'SQL_INJECTION',
            file: 'edgeCases.js',
            line: 45,
            description: 'Direct concatenation inside template literal `SELECT * WHERE code LIKE \'%9812\'`.',
            diff_before: "const q = `SELECT * FROM users WHERE code LIKE '%9812' AND id = ${user.id} AND category IN ('s', 's\\'') AND filter = '${query}'`;",
            diff_after: "const q = await db.query('SELECT * FROM users WHERE code LIKE $1 AND id = $2', ['%9812', user.id]);\n// Parameterized prepared query with template literal replacement",
            engine_source: 'HYBRID',
          },
          {
            severity: 'HIGH',
            category: 'QUALITY',
            title: 'Very Long Function Line Requiring Horizontal Wrap Safeguards',
            ruleId: 'LONG_STATEMENT',
            file: 'edgeCases.js',
            line: 78,
            description: 'Long statement exceeding typical line widths to test horizontal text wrapping.',
            diff_before: "const processTransaction = async (accountId, transactionType, transactionAmount, sourceCurrency, destinationCurrency, metadataTags, exchangeRateMultiplier, auditTraceSessionToken) => { return executeInternalTransfer(accountId, transactionType, transactionAmount); };",
            diff_after: "const processTransaction = async (accountId, transactionType, transactionAmount) => {\n  return executeInternalTransfer(accountId, transactionType, transactionAmount);\n};",
            engine_source: 'STATIC',
          },
        ],
      };

      const buffer = await generateReviewPdf(reviewData);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(4000);
      expect(buffer.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('should format timestamps strictly in Indian Standard Time (Asia/Kolkata) with IST label', () => {
      // 06:31:03 UTC is 12:01:03 IST (+05:30)
      const utcIso = '2026-10-19T06:31:03.000Z';
      const formatted = formatIstTimestamp(utcIso);

      expect(formatted).toBe('Mon, 19 Oct 2026, 12:01:03 PM IST');
      expect(formatted).toContain('IST');
      expect(formatted).not.toContain('GMT');
      expect(formatted).not.toContain('UTC');
    });

    it('should format Date objects, numerical timestamps, and offset strings consistently in IST', () => {
      const dateObj = new Date('2026-10-19T06:31:03.000Z');
      const offsetStr = '2026-10-19T12:01:03+05:30';
      const numTimestamp = dateObj.getTime();

      expect(formatIstTimestamp(dateObj)).toBe('Mon, 19 Oct 2026, 12:01:03 PM IST');
      expect(formatIstTimestamp(offsetStr)).toBe('Mon, 19 Oct 2026, 12:01:03 PM IST');
      expect(formatIstTimestamp(numTimestamp)).toBe('Mon, 19 Oct 2026, 12:01:03 PM IST');
    });

    it('should gracefully handle invalid or empty date inputs', () => {
      expect(formatIstTimestamp(null)).toBe('');
      expect(formatIstTimestamp(undefined)).toBe('');
      expect(formatIstTimestamp('invalid-date-string')).toBe('');
    });
  });

  // ============================================================================
  // SUITE 2: README Generator Unit Tests
  // ============================================================================
  describe('README Generator (generateSuggestedReadme)', () => {
    it('should generate standard GitHub markdown with badges, architecture, and setup instructions', () => {
      const reviewData = {
        projectName: 'Payment Gateway SDK',
        healthScore: 92,
        grade: 'A',
        sourceType: 'github',
        repoUrl: 'https://github.com/fintech/pay-sdk',
        files: [{ file_path: 'pay.go', language: 'Go', lines_count: 350, issues_count: 0 }],
        issues: [],
      };

      const md = generateSuggestedReadme(reviewData);

      expect(typeof md).toBe('string');
      expect(md).toContain('# Payment Gateway SDK');
      expect(md).toContain('Re%3ACode%20Health-92%2F100');
      expect(md).toContain('Grade A');
      expect(md).toContain('Architecture & Evaluated Units');
      expect(md).toContain('pay.go');
      expect(md).toContain('go mod tidy');
      expect(md).toContain('Shivam Vishwakarma');
    });
  });

  // ============================================================================
  // SUITE 3: HTTP API Endpoints (GET /:id/pdf & GET /:id/readme)
  // ============================================================================
  describe('HTTP Endpoints: /api/v1/reviews/:id/pdf & /api/v1/reviews/:id/readme', () => {
    let testReviewId;
    const testGuestId = `guest_reports_${Date.now()}`;

    beforeAll(async () => {
      testReviewId = crypto.randomUUID();
      await saveReviewResult({
        id: testReviewId,
        guestSessionId: testGuestId,
        projectName: 'Report Test Project',
        sourceType: 'direct',
        healthScore: 88,
        grade: 'B+',
        files: [{ path: 'app.js', language: 'javascript', linesCount: 90 }],
        issues: [
          {
            file: 'app.js',
            line: 15,
            severity: 'MEDIUM',
            ruleId: 'EMPTY_CATCH',
            title: 'Empty Exception Handler',
            description: 'Errors swallowed without logging.',
          },
        ],
      });
      createdReviewIds.push(testReviewId);
    });

    it('should download a valid PDF via GET /api/v1/reviews/:id/pdf', async () => {
      const res = await request(app)
        .get(`/api/v1/reviews/${testReviewId}/pdf`)
        .set('x-guest-session-id', testGuestId);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('.pdf');
      expect(res.body.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('should download suggested README via GET /api/v1/reviews/:id/readme', async () => {
      const res = await request(app)
        .get(`/api/v1/reviews/${testReviewId}/readme`)
        .set('x-guest-session-id', testGuestId);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/markdown');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('README_');
      expect(res.text).toContain('# Report Test Project');
      expect(res.text).toContain('Re%3ACode%20Health-88%2F100');
    });

    it('should return 404 when downloading PDF for non-existent review ID', async () => {
      const fakeId = crypto.randomUUID();
      const res = await request(app).get(`/api/v1/reviews/${fakeId}/pdf`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
