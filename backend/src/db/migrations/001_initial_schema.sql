-- ==============================================================================
-- Re:Code — Database Migration 001: Initial Core Schema & RLS Security
-- Read. Review. Refine. Automated Code Diagnostics & AST Analysis Platform
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Helper Function for Guest Session Header Extraction
CREATE OR REPLACE FUNCTION public.current_guest_session_id()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.headers', true)::json->>'x-guest-session-id', ''),
    nullif(current_setting('app.current_guest_session_id', true), '')
  );
$$;

-- ==============================================================================
-- TABLE 1: profiles
-- User account profiles linked to Supabase Auth (auth.users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'developer',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Automatic Profile Synchronization on auth.users Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'developer')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- TABLE 2: reviews
-- Code review audit sessions for authenticated users or guest sandboxes
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NULL,
  guest_session_id TEXT NULL,
  project_name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('direct', 'github')),
  repo_url TEXT,
  health_score NUMERIC(5, 2),
  grade TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_review_owner CHECK (user_id IS NOT NULL OR guest_session_id IS NOT NULL)
);

-- ==============================================================================
-- TABLE 3: review_files
-- Individual source code files evaluated during an AST review session
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.review_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  language TEXT NOT NULL,
  lines_count INTEGER DEFAULT 0,
  issues_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- TABLE 4: review_issues
-- Security vulnerabilities, AST code smells, and AI remediation diffs
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.review_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES public.review_files(id) ON DELETE CASCADE,
  line_number INTEGER,
  severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO')),
  category TEXT NOT NULL CHECK (category IN ('SYNTAX', 'SECURITY', 'QUALITY', 'OPTIMIZATION')),
  rule_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  remediation TEXT,
  diff_before TEXT,
  diff_after TEXT,
  engine_source TEXT NOT NULL CHECK (engine_source IN ('STATIC', 'GEMINI', 'HYBRID')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- TABLE 5: review_reports
-- Exportable audit reports (JSON, Markdown, PDF, SARIF)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.review_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  download_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- SCHEMA INDEXES
-- Critical performance indexes on foreign keys and querying vectors
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_guest_session_id ON public.reviews(guest_session_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status);
CREATE INDEX IF NOT EXISTS idx_review_files_review_id ON public.review_files(review_id);
CREATE INDEX IF NOT EXISTS idx_review_issues_review_id ON public.review_issues(review_id);
CREATE INDEX IF NOT EXISTS idx_review_issues_file_id ON public.review_issues(file_id);
CREATE INDEX IF NOT EXISTS idx_review_issues_severity ON public.review_issues(severity);
CREATE INDEX IF NOT EXISTS idx_review_issues_category ON public.review_issues(category);
CREATE INDEX IF NOT EXISTS idx_review_reports_review_id ON public.review_reports(review_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict isolation for authenticated users (auth.uid()) & guest session IDs
-- ==============================================================================

-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 1. Profiles RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- 2. Reviews RLS Policies
-- ------------------------------------------------------------------------------
-- Authenticated Users: Full CRUD on own reviews
DROP POLICY IF EXISTS "reviews_auth_select" ON public.reviews;
CREATE POLICY "reviews_auth_select"
  ON public.reviews
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_auth_insert" ON public.reviews;
CREATE POLICY "reviews_auth_insert"
  ON public.reviews
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_auth_update" ON public.reviews;
CREATE POLICY "reviews_auth_update"
  ON public.reviews
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_auth_delete" ON public.reviews;
CREATE POLICY "reviews_auth_delete"
  ON public.reviews
  FOR DELETE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Guest Sessions: Constrained strictly to matching guest_session_id
DROP POLICY IF EXISTS "reviews_guest_select" ON public.reviews;
CREATE POLICY "reviews_guest_select"
  ON public.reviews
  FOR SELECT
  USING (
    user_id IS NULL 
    AND guest_session_id IS NOT NULL 
    AND guest_session_id = public.current_guest_session_id()
  );

DROP POLICY IF EXISTS "reviews_guest_insert" ON public.reviews;
CREATE POLICY "reviews_guest_insert"
  ON public.reviews
  FOR INSERT
  WITH CHECK (
    user_id IS NULL 
    AND guest_session_id IS NOT NULL 
    AND (
      public.current_guest_session_id() IS NULL 
      OR guest_session_id = public.current_guest_session_id()
    )
  );

DROP POLICY IF EXISTS "reviews_guest_update" ON public.reviews;
CREATE POLICY "reviews_guest_update"
  ON public.reviews
  FOR UPDATE
  USING (
    user_id IS NULL 
    AND guest_session_id IS NOT NULL 
    AND guest_session_id = public.current_guest_session_id()
  )
  WITH CHECK (
    user_id IS NULL 
    AND guest_session_id IS NOT NULL 
    AND guest_session_id = public.current_guest_session_id()
  );

DROP POLICY IF EXISTS "reviews_guest_delete" ON public.reviews;
CREATE POLICY "reviews_guest_delete"
  ON public.reviews
  FOR DELETE
  USING (
    user_id IS NULL 
    AND guest_session_id IS NOT NULL 
    AND guest_session_id = public.current_guest_session_id()
  );

-- ------------------------------------------------------------------------------
-- 3. Review Files RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "review_files_auth_all" ON public.review_files;
CREATE POLICY "review_files_auth_all"
  ON public.review_files
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_files.review_id
      AND r.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_files.review_id
      AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "review_files_guest_all" ON public.review_files;
CREATE POLICY "review_files_guest_all"
  ON public.review_files
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_files.review_id
      AND r.user_id IS NULL
      AND r.guest_session_id = public.current_guest_session_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_files.review_id
      AND r.user_id IS NULL
      AND r.guest_session_id = public.current_guest_session_id()
    )
  );

-- ------------------------------------------------------------------------------
-- 4. Review Issues RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "review_issues_auth_all" ON public.review_issues;
CREATE POLICY "review_issues_auth_all"
  ON public.review_issues
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_issues.review_id
      AND r.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_issues.review_id
      AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "review_issues_guest_all" ON public.review_issues;
CREATE POLICY "review_issues_guest_all"
  ON public.review_issues
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_issues.review_id
      AND r.user_id IS NULL
      AND r.guest_session_id = public.current_guest_session_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_issues.review_id
      AND r.user_id IS NULL
      AND r.guest_session_id = public.current_guest_session_id()
    )
  );

-- ------------------------------------------------------------------------------
-- 5. Review Reports RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "review_reports_auth_all" ON public.review_reports;
CREATE POLICY "review_reports_auth_all"
  ON public.review_reports
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_reports.review_id
      AND r.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_reports.review_id
      AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "review_reports_guest_all" ON public.review_reports;
CREATE POLICY "review_reports_guest_all"
  ON public.review_reports
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_reports.review_id
      AND r.user_id IS NULL
      AND r.guest_session_id = public.current_guest_session_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_reports.review_id
      AND r.user_id IS NULL
      AND r.guest_session_id = public.current_guest_session_id()
    )
  );
