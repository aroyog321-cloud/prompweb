-- Only run the security policy updates

-- Drop existing policies if they exist (prevents errors on re-run)
DROP POLICY IF EXISTS "Users read own history" ON "PromptHistory";
DROP POLICY IF EXISTS "Users insert own history" ON "PromptHistory";
DROP POLICY IF EXISTS "Users update own history" ON "PromptHistory";
DROP POLICY IF EXISTS "Users delete own history" ON "PromptHistory";

DROP POLICY IF EXISTS "Users read own context" ON "ContextProfile";
DROP POLICY IF EXISTS "Users insert own context" ON "ContextProfile";
DROP POLICY IF EXISTS "Users update own context" ON "ContextProfile";
DROP POLICY IF EXISTS "Users delete own context" ON "ContextProfile";

DROP POLICY IF EXISTS "Users read own usage" ON usage_stats;

-- Create comprehensive policies for PromptHistory
CREATE POLICY "Users read own history" ON "PromptHistory"
  FOR SELECT USING (auth.uid()::text = "userId"::text);

CREATE POLICY "Users insert own history" ON "PromptHistory"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId"::text);

CREATE POLICY "Users update own history" ON "PromptHistory"
  FOR UPDATE USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);

CREATE POLICY "Users delete own history" ON "PromptHistory"
  FOR DELETE USING (auth.uid()::text = "userId"::text);

-- Create comprehensive policies for ContextProfile
CREATE POLICY "Users read own context" ON "ContextProfile"
  FOR SELECT USING (auth.uid()::text = "userId"::text);

CREATE POLICY "Users insert own context" ON "ContextProfile"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId"::text);

CREATE POLICY "Users update own context" ON "ContextProfile"
  FOR UPDATE USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);

CREATE POLICY "Users delete own context" ON "ContextProfile"
  FOR DELETE USING (auth.uid()::text = "userId"::text);

-- Create read-only policy for usage_stats
CREATE POLICY "Users read own usage" ON usage_stats
  FOR SELECT USING (auth.uid()::text = id::text);
