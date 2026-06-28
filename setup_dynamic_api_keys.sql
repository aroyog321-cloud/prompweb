-- ============================================================
-- Dynamic API Key Setup
-- Run this in Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. Ensure the ApiKey table exists (from earlier migrations)
CREATE TABLE IF NOT EXISTS public."ApiKey" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    secret TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Ensure the SystemSetting table exists
CREATE TABLE IF NOT EXISTS public."SystemSetting" (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Insert your Gemini API Key into the ApiKey table
-- IMPORTANT: Replace 'AIzaSyYourRealGeminiKeyHere...' with your actual Google AI Studio API key
INSERT INTO public."ApiKey" (name, secret, enabled)
VALUES ('gemini_production_key', 'AIzaSyYourRealGeminiKeyHere...', true)
ON CONFLICT (name) DO UPDATE 
SET secret = EXCLUDED.secret, enabled = EXCLUDED.enabled;

-- 4. Tell the system to use this key by setting the optimize_key setting
INSERT INTO public."SystemSetting" (key, value)
VALUES ('optimize_key', 'gemini_production_key')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, updated_at = NOW();

-- Now, your Next.js app will fetch this key dynamically!
