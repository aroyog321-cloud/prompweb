-- supabase/migrations/rls_canonical.sql
-- ============================================================
-- Single idempotent source of truth for all RLS policies.
-- Safe to re-run.
--
-- ACTUAL COLUMN TYPES (verified from Supabase):
--   PromptHistory.userId  → TEXT
--   ContextProfile.userId → TEXT
--   usage_stats.id        → UUID
--
-- Therefore:
--   PromptHistory / ContextProfile: auth.uid()::text = "userId"  (cast uuid→text)
--   usage_stats:                    auth.uid() = id              (both uuid, no cast)
-- ============================================================

-- Enable RLS
ALTER TABLE "PromptHistory"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContextProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_stats      ENABLE ROW LEVEL SECURITY;

-- PromptHistory: full CRUD, owner-only
-- userId is TEXT, auth.uid() is UUID → cast auth.uid() to text
DROP POLICY IF EXISTS "Users read own history"    ON "PromptHistory";
DROP POLICY IF EXISTS "Users insert own history"  ON "PromptHistory";
DROP POLICY IF EXISTS "Users update own history"  ON "PromptHistory";
DROP POLICY IF EXISTS "Users delete own history"  ON "PromptHistory";
DROP POLICY IF EXISTS "Users manage own history"  ON "PromptHistory";

CREATE POLICY "Users read own history" ON "PromptHistory"
  FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users insert own history" ON "PromptHistory"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Users update own history" ON "PromptHistory"
  FOR UPDATE
  USING      (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Users delete own history" ON "PromptHistory"
  FOR DELETE USING (auth.uid()::text = "userId");

-- ContextProfile: full CRUD, owner-only
-- userId is TEXT, auth.uid() is UUID → cast auth.uid() to text
DROP POLICY IF EXISTS "Users read own context"    ON "ContextProfile";
DROP POLICY IF EXISTS "Users insert own context"  ON "ContextProfile";
DROP POLICY IF EXISTS "Users update own context"  ON "ContextProfile";
DROP POLICY IF EXISTS "Users delete own context"  ON "ContextProfile";
DROP POLICY IF EXISTS "Users manage own context"  ON "ContextProfile";

CREATE POLICY "Users read own context" ON "ContextProfile"
  FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users insert own context" ON "ContextProfile"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Users update own context" ON "ContextProfile"
  FOR UPDATE
  USING      (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Users delete own context" ON "ContextProfile"
  FOR DELETE USING (auth.uid()::text = "userId");

-- usage_stats: SELECT + INSERT + UPDATE only
-- id is UUID, auth.uid() is UUID → direct comparison, no cast needed
DROP POLICY IF EXISTS "Users read own usage"    ON usage_stats;
DROP POLICY IF EXISTS "Users insert own usage"  ON usage_stats;
DROP POLICY IF EXISTS "Users update own usage"  ON usage_stats;
DROP POLICY IF EXISTS "Users delete own usage"  ON usage_stats;
DROP POLICY IF EXISTS "Users manage own usage"  ON usage_stats;

CREATE POLICY "Users read own usage" ON usage_stats
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users insert own usage" ON usage_stats
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users update own usage" ON usage_stats
  FOR UPDATE
  USING      (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- No DELETE policy for usage_stats — quota rows are immutable from the client.

-- Verify
SELECT tablename, policyname, cmd
FROM   pg_policies
WHERE  tablename IN ('PromptHistory', 'ContextProfile', 'usage_stats')
ORDER  BY tablename, cmd;
