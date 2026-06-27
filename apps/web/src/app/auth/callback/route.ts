import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Run public-table upsert concurrently with the redirect preparation.
      // We intentionally do NOT await this — a sync failure must never block
      // the user from reaching the dashboard.
      upsertPublicTables(supabase).catch((err) =>
        console.error('[Auth Callback] Public table upsert failed:', err)
      )

      return NextResponse.redirect(`${origin}${next}`)
    }

    console.error('[Auth Callback] exchangeCodeForSession error:', error)
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    )
  }

  return NextResponse.redirect(`${origin}/login?error=Invalid+auth+callback`)
}


// ─── Helper: upsert all public tables for the authenticated user ──────────────
async function upsertPublicTables(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const admin = getSupabaseAdmin()
  const now = new Date().toISOString()
  const today = now.split('T')[0] // YYYY-MM-DD

  const displayName =
    user.user_metadata?.full_name  ??   // Google OAuth
    user.user_metadata?.name       ??   // GitHub OAuth
    user.email?.split('@')[0]      ??
    ''

  // 1. Upsert public."User"  ─ the FK anchor for PromptHistory etc.
  const { error: userError } = await admin.from('User').upsert(
    {
      id:          user.id,
      email:       user.email ?? '',
      name:        displayName,
      image:       user.user_metadata?.avatar_url ?? null,
      role:        'USER',
      createdAt:   now,
      updatedAt:   now,
    },
    { onConflict: 'id' }  // updates email/name/image on re-login
  )
  if (userError) console.error('[Auth Callback] User upsert error:', userError)

  // 2. Create usage_stats row only if it doesn't already exist.
  //    ignoreDuplicates: true → never overwrite tier/counters that
  //    the billing system has already set.
  const { error: statsError } = await admin.from('usage_stats').upsert(
    {
      id:                    user.id,
      tier:                  'free',
      total_requests_today:  0,
      aggressive_expert_today: 0,
      regenerations_today:   0,
      last_reset_date:       today,
      updated_at:            now,
    },
    { onConflict: 'id', ignoreDuplicates: true }
  )
  if (statsError) console.error('[Auth Callback] usage_stats upsert error:', statsError)

  // 3. Create a FREE Subscription if one doesn't exist yet.
  const { data: existingSub } = await admin
    .from('Subscription')
    .select('id')
    .eq('userId', user.id)
    .maybeSingle()             // maybeSingle() returns null instead of throwing on 0 rows

  if (!existingSub) {
    const { error: subError } = await admin.from('Subscription').insert({
      id:         crypto.randomUUID(),
      userId:     user.id,
      tier:       'FREE',
      createdAt:  now,
      updatedAt:  now,
    })
    if (subError) console.error('[Auth Callback] Subscription insert error:', subError)
  }
}
