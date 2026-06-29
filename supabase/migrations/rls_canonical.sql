-- supabase/migrations/rls_canonical.sql
-- ============================================================
-- Single idempotent source of truth for all RLS policies.
-- Safe to re-run. Supersedes:
--   supabase_rls_setup.sql, supabase_rls_writes.sql,
--   supabase_rls_fixes.sql, master_audit_fixes.sql,
--   migration_audit_fixes.sql (RLS sections)
--
-- FIX: "userId" columns are uuid type. Using auth.uid() = "userId"
-- directly (uuid = uuid) instead of auth.uid()::text = "userId"
-- which caused: ERROR 42883: operator does not exist: text = uuid
-- ============================================================

-- Enable RLS
ALTER TABLE "PromptHistory"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContextProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_stats      ENABLE ROW LEVEL SECURITY;

-- PromptHistory: full CRUD, owner-only
DROP POLICY IF EXISTS "Users read own history"    ON "PromptHistory";
DROP POLICY IF EXISTS "Users insert own history"  ON "PromptHistory";
DROP POLICY IF EXISTS "Users update own history"  ON "PromptHistory";
DROP POLICY IF EXISTS "Users delete own history"  ON "PromptHistory";
DROP POLICY IF EXISTS "Users manage own history"  ON "PromptHistory";

CREATE POLICY "Users read own history" ON "PromptHistory"
  FOR SELECT USING (auth.uid() = "userId");

CREATE POLICY "Users insert own history" ON "PromptHistory"
  FOR INSERT WITH CHECK (auth.uid() = "userId");

CREATE POLICY "Users update own history" ON "PromptHistory"
  FOR UPDATE
  USING      (auth.uid() = "userId")
  WITH CHECK (auth.uid() = "userId");

CREATE POLICY "Users delete own history" ON "PromptHistory"
  FOR DELETE USING (auth.uid() = "userId");

-- ContextProfile: full CRUD, owner-only
DROP POLICY IF EXISTS "Users read own context"    ON "ContextProfile";
DROP POLICY IF EXISTS "Users insert own context"  ON "ContextProfile";
DROP POLICY IF EXISTS "Users update own context"  ON "ContextProfile";
DROP POLICY IF EXISTS "Users delete own context"  ON "ContextProfile";
DROP POLICY IF EXISTS "Users manage own context"  ON "ContextProfile";

CREATE POLICY "Users read own context" ON "ContextProfile"
  FOR SELECT USING (auth.uid() = "userId");

CREATE POLICY "Users insert own context" ON "ContextProfile"
  FOR INSERT WITH CHECK (auth.uid() = "userId");

CREATE POLICY "Users update own context" ON "ContextProfile"
  FOR UPDATE
  USING      (auth.uid() = "userId")
  WITH CHECK (auth.uid() = "userId");

CREATE POLICY "Users delete own context" ON "ContextProfile"
  FOR DELETE USING (auth.uid() = "userId");

-- usage_stats: SELECT + INSERT + UPDATE only
-- usage_stats.id stores the user UUID. Cast to uuid in case the column
-- is text type — the cast is a no-op if it is already uuid.
DROP POLICY IF EXISTS "Users read own usage"    ON usage_stats;
DROP POLICY IF EXISTS "Users insert own usage"  ON usage_stats;
DROP POLICY IF EXISTS "Users update own usage"  ON usage_stats;
DROP POLICY IF EXISTS "Users delete own usage"  ON usage_stats;
DROP POLICY IF EXISTS "Users manage own usage"  ON usage_stats;

CREATE POLICY "Users read own usage" ON usage_stats
  FOR SELECT USING (auth.uid() = id::uuid);

CREATE POLICY "Users insert own usage" ON usage_stats
  FOR INSERT WITH CHECK (auth.uid() = id::uuid);

CREATE POLICY "Users update own usage" ON usage_stats
  FOR UPDATE
  USING      (auth.uid() = id::uuid)
  WITH CHECK (auth.uid() = id::uuid);

-- No DELETE policy for usage_stats — quota rows are immutable from the client.
-- Server-side admin client bypasses RLS for admin operations.

COMMENT ON COLUMN usage_stats.id IS
  'user_id: the Supabase auth.users UUID for this row. Acts as both PK and FK. '
  'Consider renaming to user_id in a future migration for clarity.';

-- Verify: run this to confirm policies are active
SELECT tablename, policyname, cmd
FROM   pg_policies
WHERE  tablename IN ('PromptHistory', 'ContextProfile', 'usage_stats')
ORDER  BY tablename, cmd;
