const { supabaseAdmin, supabaseAnon, createScopedClient } = require('../src/config/supabaseClient');

describe('Module 3: Database & Supabase Client Integration', () => {
  const testGuestSession = `jest_guest_${Date.now()}`;
  let createdReviewId = null;

  test('supabaseAdmin client should be instantiated and ready', () => {
    expect(supabaseAdmin).toBeDefined();
    expect(typeof supabaseAdmin.from).toBe('function');
  });

  test('supabaseAnon client should be instantiated and ready', () => {
    expect(supabaseAnon).toBeDefined();
    expect(typeof supabaseAnon.from).toBe('function');
  });

  test('createScopedClient should create client with custom guestSessionId header', () => {
    const scoped = createScopedClient({ guestSessionId: testGuestSession });
    expect(scoped).toBeDefined();
    expect(typeof scoped.from).toBe('function');
  });

  test('supabaseAdmin can insert, fetch, and cascade delete reviews and child issues', async () => {
    // 1. Insert review
    const { data: review, error: revErr } = await supabaseAdmin
      .from('reviews')
      .insert({
        project_name: 'jest-test-repo',
        source_type: 'direct',
        guest_session_id: testGuestSession,
        status: 'completed',
        health_score: 88.0,
        grade: 'B',
        summary: 'Jest Automated Test Session',
      })
      .select()
      .single();

    expect(revErr).toBeNull();
    expect(review).toBeDefined();
    expect(review.id).toBeDefined();
    createdReviewId = review.id;

    // 2. Insert child file with review_id
    const { data: file, error: fileErr } = await supabaseAdmin
      .from('review_files')
      .insert({
        review_id: createdReviewId,
        file_path: 'src/index.js',
        language: 'JavaScript',
        lines_count: 50,
        issues_count: 1,
      })
      .select()
      .single();

    expect(fileErr).toBeNull();
    expect(file.review_id).toBe(createdReviewId);

    // 3. Insert child issue with review_id and file_id
    const { data: issue, error: issueErr } = await supabaseAdmin
      .from('review_issues')
      .insert({
        review_id: createdReviewId,
        file_id: file.id,
        line_number: 10,
        severity: 'HIGH',
        category: 'SECURITY',
        rule_id: 'OWASP-A01',
        title: 'Broken Access Control',
        engine_source: 'STATIC',
      })
      .select()
      .single();

    expect(issueErr).toBeNull();
    expect(issue.review_id).toBe(createdReviewId);

    // 4. Query via scoped guest client with matching session ID
    const scopedClient = createScopedClient({ guestSessionId: testGuestSession });
    const { data: scopedResults, error: scopedErr } = await scopedClient
      .from('reviews')
      .select('id, project_name')
      .eq('id', createdReviewId);

    expect(scopedErr).toBeNull();
    expect(scopedResults.length).toBe(1);
    expect(scopedResults[0].id).toBe(createdReviewId);

    // 5. Query via scoped guest client with non-matching session ID should return 0 records
    const nonMatchingClient = createScopedClient({ guestSessionId: 'different_unauthorized_guest' });
    const { data: nonMatchingResults, error: nonMatchingErr } = await nonMatchingClient
      .from('reviews')
      .select('id, project_name')
      .eq('id', createdReviewId);

    expect(nonMatchingErr).toBeNull();
    expect(nonMatchingResults.length).toBe(0);

    // 6. Clean up: Delete review, should cascade delete files and issues
    const { error: delErr } = await supabaseAdmin
      .from('reviews')
      .delete()
      .eq('id', createdReviewId);

    expect(delErr).toBeNull();

    // Verify cascade deletion
    const { data: remainingIssues } = await supabaseAdmin
      .from('review_issues')
      .select('id')
      .eq('review_id', createdReviewId);

    expect(remainingIssues.length).toBe(0);
  }, 15000);
});
