-- ==============================================================================
-- MIGRATION 003: Ensure RLS Policy for Authenticated User Review History
-- Allows authenticated users to query their own reviews via auth.uid()
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Users can read own reviews'
  ) THEN
    CREATE POLICY "Users can read own reviews"
      ON public.reviews
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;
