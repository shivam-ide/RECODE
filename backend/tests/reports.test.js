const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const { generateReviewPdf } = require('../src/services/reports/pdfGenerator');
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
