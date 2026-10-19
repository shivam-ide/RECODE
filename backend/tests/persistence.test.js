const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const {
  saveReviewResult,
  getReviewById,
  deleteReviewById,
} = require('../src/services/persistence/reviewRepository');
const { supabaseAdmin } = require('../src/config/supabaseClient');

describe('Module 12: Database Persistence & Repository Layer (reviewRepository.js)', () => {
  jest.setTimeout(25000);
  const createdReviewIds = [];

  afterAll(async () => {
    // Cleanup any lingering test review records (which cascades to files and issues)
    for (const id of createdReviewIds) {
      try {
        await supabaseAdmin.from('reviews').delete().eq('id', id);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  // ============================================================================
  // SUITE 1: Review Insert with Files and Linked Issues (saveReviewResult)
  // ============================================================================
  describe('Database Insert (saveReviewResult)', () => {
    it('should successfully insert a review, batch files, and linked issues returning review UUID', async () => {
      const reviewId = crypto.randomUUID();
      const guestSessionId = `guest_test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      const reviewData = {
        id: reviewId,
        guestSessionId,
        projectName: 'recode-persistence-suite',
        sourceType: 'direct',
        repoUrl: null,
        healthScore: 85,
        grade: 'B+',
        status: 'completed',
        summary: 'Unit test evaluation for database persistence service.',
        partialMode: false,
        files: [
          {
            path: 'src/auth/authService.js',
            language: 'javascript',
            linesCount: 150,
            issuesCount: 1,
          },
          {
            path: 'src/database/dbPool.js',
            language: 'javascript',
            linesCount: 80,
            issuesCount: 1,
          },
        ],
        issues: [
          {
            file: 'src/auth/authService.js',
            line: 45,
            severity: 'CRITICAL',
            category: 'SECURITY',
            ruleId: 'SQL_INJECTION',
            title: 'SQL Injection in Query Call',
            explanation: 'Direct parameter concatenation detected inside query execution.',
            diff_before: 'db.query("SELECT * FROM users WHERE id = " + id);',
            diff_after: 'db.query("SELECT * FROM users WHERE id = $1", [id]);',
            engine_source: 'HYBRID',
          },
          {
            file: 'src/database/dbPool.js',
            line: 12,
            severity: 'HIGH',
            category: 'SECURITY',
            ruleId: 'HARDCODED_SECRET',
            title: 'Exposed Database Password',
            explanation: 'Plaintext secret credential found.',
            diff_before: 'const pass = "secret123456789";',
            diff_after: 'const pass = process.env.DB_PASS;',
            engine_source: 'STATIC',
          },
        ],
      };

      const returnedId = await saveReviewResult(reviewData);
      createdReviewIds.push(returnedId);

      expect(returnedId).toBe(reviewId);

      // Verify row exists in `reviews` table
      const { data: dbReview, error: reviewErr } = await supabaseAdmin
        .from('reviews')
        .select('*')
        .eq('id', reviewId)
        .single();

      expect(reviewErr).toBeNull();
      expect(dbReview).toBeDefined();
      expect(dbReview.id).toBe(reviewId);
      expect(dbReview.project_name).toBe('recode-persistence-suite');
      expect(dbReview.source_type).toBe('direct');
      expect(Number(dbReview.health_score)).toBe(85);
      expect(dbReview.grade).toBe('B+');
      expect(dbReview.status).toBe('completed');
      expect(dbReview.guest_session_id).toBe(guestSessionId);
      expect(dbReview.partial_mode).toBe(false);

      // Verify batch rows in `review_files`
      const { data: dbFiles, error: filesErr } = await supabaseAdmin
        .from('review_files')
        .select('*')
        .eq('review_id', reviewId);

      expect(filesErr).toBeNull();
      expect(dbFiles).toHaveLength(2);
      expect(dbFiles.map((f) => f.file_path).sort()).toEqual([
        'src/auth/authService.js',
        'src/database/dbPool.js',
      ]);

      // Verify batch rows in `review_issues`
      const { data: dbIssues, error: issuesErr } = await supabaseAdmin
        .from('review_issues')
        .select('*')
        .eq('review_id', reviewId);

      expect(issuesErr).toBeNull();
      expect(dbIssues).toHaveLength(2);

      const sqlIssue = dbIssues.find((i) => i.rule_id === 'SQL_INJECTION');
      expect(sqlIssue).toBeDefined();
      expect(sqlIssue.severity).toBe('CRITICAL');
      expect(sqlIssue.category).toBe('SECURITY');
      expect(sqlIssue.engine_source).toBe('HYBRID');
      expect(sqlIssue.line_number).toBe(45);

      const secretIssue = dbIssues.find((i) => i.rule_id === 'HARDCODED_SECRET');
      expect(secretIssue).toBeDefined();
      expect(secretIssue.severity).toBe('HIGH');
      expect(secretIssue.engine_source).toBe('STATIC');
      expect(secretIssue.line_number).toBe(12);
    });
  });

  // ============================================================================
  // SUITE 2: Review Retrieval with Joined Files & Issues (getReviewById)
  // ============================================================================
  describe('Database Retrieval with Joined Relations (getReviewById)', () => {
    it('should retrieve a review with joined files and issues verifying RLS/ownership', async () => {
      const reviewId = crypto.randomUUID();
      const guestSessionId = `guest_test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      await saveReviewResult({
        id: reviewId,
        guestSessionId,
        projectName: 'join-retrieval-repo',
        sourceType: 'direct',
        healthScore: 92,
        grade: 'A',
        summary: 'Clean architecture with minor notice.',
        files: [
          {
            path: 'src/main.js',
            language: 'javascript',
            linesCount: 90,
            issuesCount: 1,
          },
        ],
        issues: [
          {
            file: 'src/main.js',
            line: 5,
            severity: 'LOW',
            category: 'QUALITY',
            ruleId: 'CONSOLE_LOG_STMT',
            title: 'Console Log Found',
            explanation: 'Remove debug logging before production release.',
            diff_before: 'console.log("ready");',
            diff_after: 'logger.info("ready");',
            engine_source: 'STATIC',
          },
        ],
      });
      createdReviewIds.push(reviewId);

      // 1. Successful retrieval with matching guest session token
      const review = await getReviewById(reviewId, { guestSessionId });

      expect(review).toBeDefined();
      expect(review).not.toBeNull();
      expect(review.id).toBe(reviewId);
      expect(review.project_name).toBe('join-retrieval-repo');
      expect(Number(review.health_score)).toBe(92);
      expect(review.grade).toBe('A');

      // Joined files verification
      expect(Array.isArray(review.files)).toBe(true);
      expect(review.files).toHaveLength(1);
      expect(review.files[0].file_path).toBe('src/main.js');

      // Joined issues verification
      expect(Array.isArray(review.issues)).toBe(true);
      expect(review.issues).toHaveLength(1);
      expect(review.issues[0].rule_id).toBe('CONSOLE_LOG_STMT');
      expect(review.issues[0].line_number).toBe(5);

      // 2. Ownership check: unauthorized guest token cannot access another guest's review
      const unauthorizedResult = await getReviewById(reviewId, {
        guestSessionId: 'unauthorized_token_random_99999',
      });
      expect(unauthorizedResult).toBeNull();
    });

    it('should return null when queried for a non-existent review ID', async () => {
      const nonExistentId = crypto.randomUUID();
      const result = await getReviewById(nonExistentId, { isAdmin: true });
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // SUITE 3: Database Cascade Deletion Verification
  // ============================================================================
  describe('Cascade Deletion Verification', () => {
    it('should cascade delete linked review_files and review_issues when review is deleted', async () => {
      const reviewId = crypto.randomUUID();
      const guestSessionId = `guest_cascade_${Date.now()}`;

      await saveReviewResult({
        id: reviewId,
        guestSessionId,
        projectName: 'cascade-deletion-repo',
        sourceType: 'direct',
        healthScore: 70,
        grade: 'B',
        files: [
          { path: 'src/f1.js', language: 'javascript', linesCount: 50 },
          { path: 'src/f2.js', language: 'javascript', linesCount: 60 },
        ],
        issues: [
          { file: 'src/f1.js', line: 10, severity: 'MEDIUM', ruleId: 'EMPTY_CATCH_BLOCK' },
          { file: 'src/f2.js', line: 20, severity: 'CRITICAL', ruleId: 'SQL_INJECTION' },
        ],
      });

      // Verify files and issues exist prior to deletion
      const { data: preFiles } = await supabaseAdmin
        .from('review_files')
        .select('id')
        .eq('review_id', reviewId);
      expect(preFiles).toHaveLength(2);

      const { data: preIssues } = await supabaseAdmin
        .from('review_issues')
        .select('id')
        .eq('review_id', reviewId);
      expect(preIssues).toHaveLength(2);

      // Perform deletion of parent review row
      const deleteResult = await deleteReviewById(reviewId);
      expect(deleteResult).toBe(true);

      // 1. Verify parent review row is deleted
      const { data: postReview } = await supabaseAdmin
        .from('reviews')
        .select('id')
        .eq('id', reviewId)
        .maybeSingle();
      expect(postReview).toBeNull();

      // 2. Verify `review_files` rows were automatically cascade deleted
      const { data: postFiles } = await supabaseAdmin
        .from('review_files')
        .select('id')
        .eq('review_id', reviewId);
      expect(postFiles).toHaveLength(0);

      // 3. Verify `review_issues` rows were automatically cascade deleted
      const { data: postIssues } = await supabaseAdmin
        .from('review_issues')
        .select('id')
        .eq('review_id', reviewId);
      expect(postIssues).toHaveLength(0);
    });
  });

  // ============================================================================
  // SUITE 4: HTTP API Endpoint (GET /api/v1/reviews/:id)
  // ============================================================================
  describe('HTTP API: GET /api/v1/reviews/:id', () => {
    it('should retrieve review details via GET endpoint with x-guest-session-id header', async () => {
      const reviewId = crypto.randomUUID();
      const guestSessionId = `guest_http_${Date.now()}`;

      await saveReviewResult({
        id: reviewId,
        guestSessionId,
        projectName: 'http-api-review-repo',
        sourceType: 'direct',
        healthScore: 95,
        grade: 'A',
        summary: 'Excellent code health.',
        files: [{ path: 'src/index.js', language: 'javascript', linesCount: 100 }],
        issues: [],
      });
      createdReviewIds.push(reviewId);

      const res = await request(app)
        .get(`/api/v1/reviews/${reviewId}`)
        .set('x-guest-session-id', guestSessionId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe(reviewId);
      expect(res.body.data.project_name).toBe('http-api-review-repo');
      expect(Array.isArray(res.body.data.files)).toBe(true);
      expect(res.body.data.files).toHaveLength(1);
    });

    it('should return 404 when querying a non-existent review ID', async () => {
      const nonExistentId = crypto.randomUUID();
      const res = await request(app).get(`/api/v1/reviews/${nonExistentId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not found');
    });

    it('should retrieve audit history via GET /api/v1/reviews/history', async () => {
      const guestSessionId = `guest_hist_${Date.now()}`;
      const revId1 = crypto.randomUUID();
      const revId2 = crypto.randomUUID();

      await saveReviewResult({
        id: revId1,
        guestSessionId,
        projectName: 'History Project 1',
        sourceType: 'direct',
        healthScore: 88,
        grade: 'B+',
        files: [{ path: 'src/app.js', language: 'javascript', linesCount: 80 }],
        issues: [{ file: 'src/app.js', line: 10, severity: 'HIGH', ruleId: 'HARDCODED_SECRET' }],
      });
      createdReviewIds.push(revId1);

      await saveReviewResult({
        id: revId2,
        guestSessionId,
        projectName: 'History Project 2',
        sourceType: 'github',
        repoUrl: 'https://github.com/test/repo',
        healthScore: 100,
        grade: 'A+',
        files: [{ path: 'main.py', language: 'python', linesCount: 50 }],
        issues: [],
      });
      createdReviewIds.push(revId2);

      const res = await request(app)
        .get('/api/v1/reviews/history')
        .set('x-guest-session-id', guestSessionId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);

      const found1 = res.body.data.find((r) => r.id === revId1);
      expect(found1).toBeDefined();
      expect(found1.project_name).toBe('History Project 1');
      expect(found1.severity_counts).toBeDefined();
      expect(found1.severity_counts.HIGH).toBe(1);

      const found2 = res.body.data.find((r) => r.id === revId2);
      expect(found2).toBeDefined();
      expect(found2.project_name).toBe('History Project 2');
      expect(found2.source_type).toBe('github');
    });

    it('should delete a review via DELETE /api/v1/reviews/:id', async () => {
      const guestSessionId = `guest_del_${Date.now()}`;
      const reviewId = crypto.randomUUID();

      await saveReviewResult({
        id: reviewId,
        guestSessionId,
        projectName: 'To Delete Project',
        sourceType: 'direct',
        healthScore: 75,
        grade: 'B',
        files: [{ path: 'temp.js', language: 'javascript' }],
        issues: [],
      });

      const res = await request(app)
        .delete(`/api/v1/reviews/${reviewId}`)
        .set('x-guest-session-id', guestSessionId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deleted).toBe(true);

      // Verify it's no longer accessible
      const checkRes = await request(app).get(`/api/v1/reviews/${reviewId}`);
      expect(checkRes.status).toBe(404);
    });
  });
});

