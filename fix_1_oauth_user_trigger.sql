-- ============================================================
-- FIX 1: OAuth → Public Table Sync (THE critical fix)
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================
--
-- ROOT CAUSE: When Google OAuth creates a row in auth.users,
-- nothing creates the corresponding row in public."User".
-- Because PromptHistory has:
--   FOREIGN KEY ("userId") REFERENCES "User"("id")
-- ...EVERY SINGLE PromptHistory insert fails silently with a
-- FK violation. History is never saved. Tier is always 'free'.
--
-- This migration:
--   1. Creates a trigger that fires on every new auth.users row
--   2. Backfills existing auth users who are missing public rows
-- ============================================================

-- Safety: add last_reset_date if not already present
-- (required by increment_usage RPC — migration_usage_stats_fix.sql
-- may not have been applied yet)
ALTER TABLE public.usage_stats
  ADD COLUMN IF NOT EXISTS last_reset_date DATE DEFAULT CURRENT_DATE;


-- ─────────────────────────────────────────────────────────────
-- TRIGGER FUNCTION: new user signup
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER              -- runs as postgres owner, bypasses RLS
SET search_path = public
AS $$
BEGIN
  -- 1. Upsert public."User" — the FK anchor for PromptHistory,
  --    Subscription, ContextProfile, etc.
  INSERT INTO public."User" (id, email, name, image, role, "createdAt", "updatedAt")
  VALUES (
    NEW.id::text,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',   -- Google OAuth
      NEW.raw_user_meta_data->>'name',        -- GitHub OAuth
      split_part(COALESCE(NEW.email, ''), '@', 1)  -- email fallback
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    'USER'::"Role",
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email       = COALESCE(EXCLUDED.email, public."User".email),
    name        = COALESCE(EXCLUDED.name,  public."User".name),
    image       = COALESCE(EXCLUDED.image, public."User".image),
    "updatedAt" = NOW();

  -- 2. Create usage_stats row (idempotent).
  --    increment_usage() already bootstraps this, but creating it
  --    here means the dashboard shows the correct tier immediately,
  --    without waiting for the first optimization call.
  INSERT INTO public.usage_stats (
    id, tier, total_requests_today, aggressive_expert_today,
    regenerations_today, last_reset_date, updated_at
  )
  VALUES (NEW.id::uuid, 'free', 0, 0, 0, CURRENT_DATE, NOW())
  ON CONFLICT (id) DO NOTHING;

  -- 3. Create default Subscription (idempotent via WHERE NOT EXISTS
  --    because Subscription has no UNIQUE constraint on userId).
  INSERT INTO public."Subscription" (id, "userId", tier, "createdAt", "updatedAt")
  SELECT
    gen_random_uuid()::text,
    NEW.id::text,
    'FREE'::"SubscriptionTier",
    NOW(),
    NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM public."Subscription" WHERE "userId" = NEW.id::text
  );

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Never abort the auth user creation over a sync failure.
  -- The auth callback route.ts provides an additional safety net.
  RAISE WARNING '[Promptly] handle_new_user failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- TRIGGER FUNCTION: email / profile updates
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sync email / avatar changes (e.g. after Google re-auth)
  UPDATE public."User"
  SET
    email       = COALESCE(NEW.email, public."User".email),
    name        = COALESCE(
                    NEW.raw_user_meta_data->>'full_name',
                    NEW.raw_user_meta_data->>'name',
                    public."User".name
                  ),
    image       = COALESCE(NEW.raw_user_meta_data->>'avatar_url', public."User".image),
    "updatedAt" = NOW()
  WHERE id = NEW.id::text;

  -- Idempotent safety net for usage_stats
  INSERT INTO public.usage_stats (
    id, tier, total_requests_today, aggressive_expert_today,
    regenerations_today, last_reset_date, updated_at
  )
  VALUES (NEW.id::uuid, 'free', 0, 0, 0, CURRENT_DATE, NOW())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[Promptly] handle_user_update failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- ATTACH TRIGGERS
-- ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();


-- ─────────────────────────────────────────────────────────────
-- BACKFILL: existing auth users who are missing public rows
-- Safe to run multiple times (ON CONFLICT / WHERE NOT EXISTS).
-- ─────────────────────────────────────────────────────────────

-- Backfill public."User"
INSERT INTO public."User" (id, email, name, image, role, "createdAt", "updatedAt")
SELECT
  au.id::text,
  COALESCE(au.email, ''),
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    au.raw_user_meta_data->>'name',
    split_part(COALESCE(au.email, ''), '@', 1)
  ),
  au.raw_user_meta_data->>'avatar_url',
  'USER'::"Role",
  COALESCE(au.created_at, NOW()),
  NOW()
FROM auth.users au
ON CONFLICT (id) DO UPDATE SET
  email       = EXCLUDED.email,
  name        = COALESCE(EXCLUDED.name,  public."User".name),
  image       = COALESCE(EXCLUDED.image, public."User".image),
  "updatedAt" = NOW();

-- Backfill usage_stats
INSERT INTO public.usage_stats (
  id, tier, total_requests_today, aggressive_expert_today,
  regenerations_today, last_reset_date, updated_at
)
SELECT au.id::uuid, 'free', 0, 0, 0, CURRENT_DATE, NOW()
FROM auth.users au
ON CONFLICT (id) DO NOTHING;

-- Backfill Subscriptions
INSERT INTO public."Subscription" (id, "userId", tier, "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  au.id::text,
  'FREE'::"SubscriptionTier",
  COALESCE(au.created_at, NOW()),
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public."Subscription" s WHERE s."userId" = au.id::text
);
