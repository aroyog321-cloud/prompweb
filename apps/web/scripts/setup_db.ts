import { PrismaClient } from '../src/generated/prisma/client';
import "dotenv/config";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "prisma+postgres://localhost:51213/?api_key=eyJkYXRhYmFzZVVybCI6InBvc3RncmVzOi8vcG9zdGdyZXM6cG9zdGdyZXNAbG9jYWxob3N0OjUxMjE0L3RlbXBsYXRlMT9zc2xtb2RlPWRpc2FibGUmY29ubmVjdGlvbl9saW1pdD0xMCZjb25uZWN0X3RpbWVvdXQ9MCZtYXhfaWRsZV9jb25uZWN0aW9uX2xpZmV0aW1lPTAmcG9vbF90aW1lb3V0PTAmc29ja2V0X3RpbWVvdXQ9MCIsIm5hbWUiOiJkZWZhdWx0Iiwic2hhZG93RGF0YWJhc2VVcmwiOiJwb3N0Z3JlczovL3Bvc3RncmVzOnBvc3RncmVzQGxvY2FsaG9zdDo1MTIxNS90ZW1wbGF0ZTE_c3NsbW9kZT1kaXNhYmxlJmNvbm5lY3Rpb25fbGltaXQ9MTAmY29ubmVjdF90aW1lb3V0PTAmbWF4X2lkbGVfY29ubmVjdGlvbl9saWZldGltZT0wJnBvb2xfdGltZW91dD0wJnNvY2tldF90aW1lb3V0PTAifQ",
    },
  },
});

async function main() {
  try {
    console.log("Setting up Row Level Security and RPC...");

    // Enable RLS
    await prisma.$executeRawUnsafe(`ALTER TABLE "PromptHistory" ENABLE ROW LEVEL SECURITY;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ContextProfile" ENABLE ROW LEVEL SECURITY;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;`);
    console.log("RLS enabled on tables.");

    // Create Policies (using DO so we can handle IF NOT EXISTS gracefully in older Postgres, or just drop and recreate)
    await prisma.$executeRawUnsafe(`
      DROP POLICY IF EXISTS "Users read own history" ON "PromptHistory";
      CREATE POLICY "Users read own history" ON "PromptHistory"
        FOR SELECT USING (auth.uid()::text = "userId");
    `);

    await prisma.$executeRawUnsafe(`
      DROP POLICY IF EXISTS "Users read own context" ON "ContextProfile";
      CREATE POLICY "Users read own context" ON "ContextProfile"
        FOR SELECT USING (auth.uid()::text = "userId");
    `);

    await prisma.$executeRawUnsafe(`
      DROP POLICY IF EXISTS "Users read own usage" ON usage_stats;
      CREATE POLICY "Users read own usage" ON usage_stats
        FOR SELECT USING (auth.uid()::text = id);
    `);
    console.log("RLS SELECT policies created.");

    // Create increment_usage RPC
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION increment_usage(
        user_id uuid, is_advanced bool, is_regen bool
      ) RETURNS void AS $$
      BEGIN
        INSERT INTO usage_stats (id, tier, total_requests_today, aggressive_expert_today, regenerations_today, updated_at)
        VALUES (user_id::text, 'free', 1, CASE WHEN is_advanced THEN 1 ELSE 0 END, CASE WHEN is_regen THEN 1 ELSE 0 END, now())
        ON CONFLICT (id) DO UPDATE SET
          total_requests_today = usage_stats.total_requests_today + 1,
          aggressive_expert_today = usage_stats.aggressive_expert_today + CASE WHEN is_advanced THEN 1 ELSE 0 END,
          regenerations_today = usage_stats.regenerations_today + CASE WHEN is_regen THEN 1 ELSE 0 END,
          updated_at = now();
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
    console.log("increment_usage RPC created.");

    console.log("Database setup complete!");
  } catch (error) {
    console.error("Error setting up database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
