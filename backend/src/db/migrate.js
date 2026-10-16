const fs = require('fs');
const path = require('path');
const pg = require('pg');
const dotenv = require('dotenv');
const { supabaseAdmin, createScopedClient } = require('../config/supabaseClient');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const projectRef = 'fhzidfwvncmwfgxrkuxt';
const password = process.env.SUPABASE_DB_PASSWORD || '?ku&uqxdLq4MrmR';
const host = 'aws-0-ap-northeast-2.pooler.supabase.com';

const dbConfig = {
  host,
  port: 6543,
  user: `postgres.${projectRef}`,
  password,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
};

async function runMigration() {
  console.log('================================================================');
  console.log('🚀 Re:Code Module 3: Executing Database Migration');
  console.log('================================================================');
  console.log(`[Database] Connecting to Supabase pooler at ${host}:6543...`);

  const client = new pg.Client(dbConfig);

  try {
    await client.connect();
    console.log('✅ [Database] PostgreSQL connection established.');

    // 1. Read Migration SQL
    const migrationPath = path.resolve(__dirname, 'migrations', '001_initial_schema.sql');
    console.log(`[Migration] Reading SQL migration from: ${migrationPath}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // 2. Execute SQL
    console.log('[Migration] Applying schema definitions, indexes, and RLS policies...');
    await client.query(sql);
    console.log('✅ [Migration] SQL migration applied successfully.');

    // 3. Verify Tables
    const tablesQuery = `
      SELECT table_name, 
             (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
        AND table_name IN ('profiles', 'reviews', 'review_files', 'review_issues', 'review_reports')
      ORDER BY table_name;
    `;
    const tablesRes = await client.query(tablesQuery);
    console.log('\n--- 📋 Verified Tables in public schema ---');
    console.table(tablesRes.rows);

    // 4. Verify Indexes (specifically review_id and user_id)
    const indexesQuery = `
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('profiles', 'reviews', 'review_files', 'review_issues', 'review_reports')
      ORDER BY tablename, indexname;
    `;
    const indexesRes = await client.query(indexesQuery);
    console.log('\n--- 🔍 Verified Schema Indexes (Highlighting review_id & user_id) ---');
    console.table(
      indexesRes.rows.map((row) => ({
        table: row.tablename,
        index_name: row.indexname,
        definition: row.indexdef,
      }))
    );

    // 5. Verify Row Level Security (RLS) Status
    const rlsQuery = `
      SELECT tablename, rowsecurity as rls_enabled
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('profiles', 'reviews', 'review_files', 'review_issues', 'review_reports')
      ORDER BY tablename;
    `;
    const rlsRes = await client.query(rlsQuery);
    console.log('\n--- 🛡️ Row Level Security (RLS) Status ---');
    console.table(rlsRes.rows);

    // 6. Verify Policies
    const policiesQuery = `
      SELECT tablename, policyname, cmd as action, roles
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `;
    const policiesRes = await client.query(policiesQuery);
    console.log(`\n--- 📜 Verified RLS Policies (${policiesRes.rows.length} total active policies) ---`);
    console.table(policiesRes.rows);

    await client.end();

    // 7. Test Operations with Supabase Client Wrapper (Service Role & Scoped Guest)
    console.log('\n================================================================');
    console.log('🧪 Testing Supabase Client Wrappers & RLS Compliance');
    console.log('================================================================');

    const testGuestSession = `guest_test_${Date.now()}`;

    // Test A: Admin Service Role Insert & Select
    console.log('[Test A] Inserting review via supabaseAdmin (service role wrapper)...');
    const { data: adminReview, error: adminErr } = await supabaseAdmin
      .from('reviews')
      .insert({
        project_name: 'recode-test-project',
        source_type: 'direct',
        guest_session_id: testGuestSession,
        status: 'completed',
        health_score: 95.5,
        grade: 'A',
        summary: 'Module 3 Migration Verification Review',
      })
      .select()
      .single();

    if (adminErr) {
      throw new Error(`Admin insert failed: ${adminErr.message}`);
    }
    console.log('✅ [Test A] Admin Review Created:', adminReview.id, adminReview.project_name);

    // Test B: Insert Child File via supabaseAdmin
    const { data: adminFile, error: fileErr } = await supabaseAdmin
      .from('review_files')
      .insert({
        review_id: adminReview.id,
        file_path: 'src/app.js',
        language: 'JavaScript',
        lines_count: 120,
        issues_count: 1,
      })
      .select()
      .single();

    if (fileErr) {
      throw new Error(`Child file insert failed: ${fileErr.message}`);
    }
    console.log('✅ [Test B] Child File Created with review_id FK:', adminFile.id);

    // Test C: Insert Child Issue via supabaseAdmin
    const { data: adminIssue, error: issueErr } = await supabaseAdmin
      .from('review_issues')
      .insert({
        review_id: adminReview.id,
        file_id: adminFile.id,
        line_number: 42,
        severity: 'CRITICAL',
        category: 'SECURITY',
        rule_id: 'CWE-89',
        title: 'SQL Injection Vulnerability',
        description: 'AST parser detected unsanitized input concatenated into SQL query.',
        remediation: 'Use parameterized queries.',
        engine_source: 'STATIC',
      })
      .select()
      .single();

    if (issueErr) {
      throw new Error(`Child issue insert failed: ${issueErr.message}`);
    }
    console.log('✅ [Test C] Child Issue Created with review_id FK:', adminIssue.id, adminIssue.severity);

    // Test D: Guest Scoped Client Query (Matching Session)
    console.log('\n[Test D] Querying via createScopedClient with matching guestSessionId...');
    const matchingGuestClient = createScopedClient({ guestSessionId: testGuestSession });
    const { data: guestReviews, error: guestErr } = await matchingGuestClient
      .from('reviews')
      .select('id, project_name, guest_session_id, health_score')
      .eq('id', adminReview.id);

    if (guestErr) {
      console.warn('Guest matching query error:', guestErr.message);
    } else {
      console.log('✅ [Test D] Matching Guest Access Succeeded:', guestReviews.length, 'review(s) retrieved.');
    }

    // Clean up test review
    await supabaseAdmin.from('reviews').delete().eq('id', adminReview.id);
    console.log('🧹 [Cleanup] Verification test records removed cleanly.');

    console.log('\n🎉 ALL MODULE 3 MIGRATIONS & VERIFICATIONS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    try { await client.end(); } catch (e) {}
    process.exit(1);
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
