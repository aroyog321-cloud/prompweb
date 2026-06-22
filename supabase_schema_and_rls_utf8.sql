-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO', 'TEAM');

-- CreateEnum
CREATE TYPE "PromptMode" AS ENUM ('GENERAL', 'DEVELOPER', 'DESIGNER', 'MARKETING', 'RESEARCH', 'BUSINESS', 'CONTENT_CREATOR', 'STARTUP_FOUNDER');

-- CreateEnum
CREATE TYPE "RewriteLevel" AS ENUM ('LIGHT', 'MEDIUM', 'AGGRESSIVE', 'EXPERT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT,
    "websiteURL" TEXT,
    "industry" TEXT,
    "audience" TEXT,
    "writingStyle" TEXT,
    "brandTone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "SubscriptionTier" NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalPrompt" TEXT NOT NULL,
    "optimizedPrompt" TEXT NOT NULL,
    "platformUsed" TEXT NOT NULL,
    "promptMode" "PromptMode",
    "rewriteLevel" "RewriteLevel",
    "tokensUsed" INTEGER,
    "responseTime" DOUBLE PRECISION,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedPrompt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mode" "PromptMode",
    "level" "RewriteLevel",
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "websiteURL" TEXT,
    "industry" TEXT,
    "audience" TEXT,
    "writingStyle" TEXT,
    "brandTone" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContextProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "platform" TEXT,
    "tokensConsumed" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamWorkspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "Profile_userId_idx" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "PromptHistory_userId_idx" ON "PromptHistory"("userId");

-- CreateIndex
CREATE INDEX "PromptHistory_createdAt_idx" ON "PromptHistory"("createdAt");

-- CreateIndex
CREATE INDEX "SavedPrompt_userId_idx" ON "SavedPrompt"("userId");

-- CreateIndex
CREATE INDEX "SavedPrompt_isFavorite_idx" ON "SavedPrompt"("isFavorite");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateCategory_name_key" ON "TemplateCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateCategory_slug_key" ON "TemplateCategory"("slug");

-- CreateIndex
CREATE INDEX "TemplateCategory_slug_idx" ON "TemplateCategory"("slug");

-- CreateIndex
CREATE INDEX "Template_categoryId_idx" ON "Template"("categoryId");

-- CreateIndex
CREATE INDEX "Template_authorId_idx" ON "Template"("authorId");

-- CreateIndex
CREATE INDEX "Template_isPublic_idx" ON "Template"("isPublic");

-- CreateIndex
CREATE INDEX "ContextProfile_userId_idx" ON "ContextProfile"("userId");

-- CreateIndex
CREATE INDEX "ContextProfile_isDefault_idx" ON "ContextProfile"("isDefault");

-- CreateIndex
CREATE INDEX "UsageLog_userId_idx" ON "UsageLog"("userId");

-- CreateIndex
CREATE INDEX "UsageLog_createdAt_idx" ON "UsageLog"("createdAt");

-- CreateIndex
CREATE INDEX "UsageLog_actionType_idx" ON "UsageLog"("actionType");

-- CreateIndex
CREATE INDEX "TeamWorkspace_ownerId_idx" ON "TeamWorkspace"("ownerId");

-- CreateIndex
CREATE INDEX "WorkspaceMember_workspaceId_idx" ON "WorkspaceMember"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptHistory" ADD CONSTRAINT "PromptHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedPrompt" ADD CONSTRAINT "SavedPrompt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TemplateCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextProfile" ADD CONSTRAINT "ContextProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamWorkspace" ADD CONSTRAINT "TeamWorkspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "TeamWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Enable Row Level Security
ALTER TABLE "PromptHistory" ENABLE ROW LEVEL SECURITY;
-- CreateTable
CREATE TABLE IF NOT EXISTS "usage_stats" (
    "id" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'free',
    "total_requests_today" INTEGER NOT NULL DEFAULT 0,
    "aggressive_expert_today" INTEGER NOT NULL DEFAULT 0,
    "regenerations_today" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_stats_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ContextProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (prevents errors on re-run)
DROP POLICY IF EXISTS "Users read own history" ON "PromptHistory";
DROP POLICY IF EXISTS "Users read own context" ON "ContextProfile";
DROP POLICY IF EXISTS "Users read own usage" ON usage_stats;

-- Create policies to allow users to read their own data
-- This is REQUIRED for Supabase Realtime to push updates to the browser
CREATE POLICY "Users read own history" ON "PromptHistory"
  FOR SELECT USING (auth.uid()::text = "userId"::text);

CREATE POLICY "Users insert own history" ON "PromptHistory"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId"::text);

CREATE POLICY "Users update own history" ON "PromptHistory"
  FOR UPDATE USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);

CREATE POLICY "Users delete own history" ON "PromptHistory"
  FOR DELETE USING (auth.uid()::text = "userId"::text);

CREATE POLICY "Users read own context" ON "ContextProfile"
  FOR SELECT USING (auth.uid()::text = "userId"::text);

CREATE POLICY "Users insert own context" ON "ContextProfile"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId"::text);

CREATE POLICY "Users update own context" ON "ContextProfile"
  FOR UPDATE USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);

CREATE POLICY "Users delete own context" ON "ContextProfile"
  FOR DELETE USING (auth.uid()::text = "userId"::text);

CREATE POLICY "Users read own usage" ON usage_stats
  FOR SELECT USING (auth.uid()::text = id::text);

-- Enable Row Level Security
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedPrompt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UsageLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TemplateCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamWorkspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceMember" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (prevents errors on re-run)
DROP POLICY IF EXISTS "Users manage own User record" ON "User";
DROP POLICY IF EXISTS "Users manage own Profile" ON "Profile";
DROP POLICY IF EXISTS "Users manage own Subscription" ON "Subscription";
DROP POLICY IF EXISTS "Users manage own SavedPrompt" ON "SavedPrompt";
DROP POLICY IF EXISTS "Users manage own UsageLog" ON "UsageLog";
DROP POLICY IF EXISTS "Anyone can read TemplateCategory" ON "TemplateCategory";
DROP POLICY IF EXISTS "Anyone can read public Templates" ON "Template";
DROP POLICY IF EXISTS "Users manage own Templates" ON "Template";
DROP POLICY IF EXISTS "Users manage own TeamWorkspace" ON "TeamWorkspace";
DROP POLICY IF EXISTS "Users manage own WorkspaceMember" ON "WorkspaceMember";

-- Create policies
CREATE POLICY "Users manage own User record" ON "User"
  FOR ALL USING (auth.uid()::text = id::text) WITH CHECK (auth.uid()::text = id::text);

CREATE POLICY "Users manage own Profile" ON "Profile"
  FOR ALL USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);

CREATE POLICY "Users manage own Subscription" ON "Subscription"
  FOR ALL USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);

CREATE POLICY "Users manage own SavedPrompt" ON "SavedPrompt"
  FOR ALL USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);

CREATE POLICY "Users manage own UsageLog" ON "UsageLog"
  FOR ALL USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);

CREATE POLICY "Anyone can read TemplateCategory" ON "TemplateCategory"
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read public Templates" ON "Template"
  FOR SELECT USING ("isPublic" = true);

CREATE POLICY "Users manage own Templates" ON "Template"
  FOR ALL USING (auth.uid()::text = "authorId"::text) WITH CHECK (auth.uid()::text = "authorId"::text);

CREATE POLICY "Users manage own TeamWorkspace" ON "TeamWorkspace"
  FOR ALL USING (auth.uid()::text = "ownerId"::text) WITH CHECK (auth.uid()::text = "ownerId"::text);

CREATE POLICY "Users manage own WorkspaceMember" ON "WorkspaceMember"
  FOR ALL USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);
