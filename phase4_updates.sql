-- Phase 4: Database & Analytics Updates

-- 1. Add deletedAt for soft deletion
ALTER TABLE "PromptHistory" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "SavedPrompt" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Template" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "ContextProfile" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- 2. Add compound indexes
CREATE INDEX IF NOT EXISTS "PromptHistory_userId_createdAt_idx" ON "PromptHistory"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "UsageLog_userId_createdAt_idx" ON "UsageLog"("userId", "createdAt" DESC);

-- 3. Optimization Metrics table
CREATE TABLE IF NOT EXISTS "optimization_metrics" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "mode" "PromptMode",
    "level" "RewriteLevel",
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Optimization Metrics indexes
CREATE INDEX IF NOT EXISTS "optimization_metrics_userId_idx" ON "optimization_metrics"("userId");
CREATE INDEX IF NOT EXISTS "optimization_metrics_createdAt_idx" ON "optimization_metrics"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "optimization_metrics_mode_level_idx" ON "optimization_metrics"("mode", "level");

-- RLS for optimization_metrics
ALTER TABLE "optimization_metrics" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own metrics" ON "optimization_metrics";
CREATE POLICY "Users manage own metrics" ON "optimization_metrics"
    FOR ALL USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);
