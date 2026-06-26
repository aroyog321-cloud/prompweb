-- ============================================================
-- Migration: Add new Prompt Compiler tiers to RewriteLevel enum
-- Date: 2026-06-26
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- The application code now uses new tiers from the Prompt Compiler.
-- Without these enum values, the API will crash when trying to save prompt history.

DO $$
BEGIN
  -- Add BASIC
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'BASIC'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'RewriteLevel')
  ) THEN
    ALTER TYPE "RewriteLevel" ADD VALUE 'BASIC';
  END IF;

  -- Add PROFESSIONAL
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'PROFESSIONAL'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'RewriteLevel')
  ) THEN
    ALTER TYPE "RewriteLevel" ADD VALUE 'PROFESSIONAL';
  END IF;

  -- Add STAFF+
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'STAFF+'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'RewriteLevel')
  ) THEN
    ALTER TYPE "RewriteLevel" ADD VALUE 'STAFF+';
  END IF;

  -- Add RESEARCH
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'RESEARCH'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'RewriteLevel')
  ) THEN
    ALTER TYPE "RewriteLevel" ADD VALUE 'RESEARCH';
  END IF;

  -- Add PRODUCTION AUDIT
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'PRODUCTION AUDIT'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'RewriteLevel')
  ) THEN
    ALTER TYPE "RewriteLevel" ADD VALUE 'PRODUCTION AUDIT';
  END IF;
END$$;
