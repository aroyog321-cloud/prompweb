export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Unused variables removed to prevent initialization crash

function getAuthToken(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

async function getUser(token: string) {
  const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error) console.error("getUser error:", error);
  return error ? null : user;
}

export async function GET(request: Request) {
  try {
    const token = getAuthToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized. Missing token." }, { status: 401 });

    const user = await getUser(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid Access Token." }, { status: 401 });
    }

    const adminClient = getSupabaseAdmin();

    const url = new URL(request.url);
    const rawLimit = parseInt(url.searchParams.get('limit') || '30', 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 30;

    let query = adminClient
      .from('PromptHistory')
      .select('id, platformUsed, promptMode, rewriteLevel, createdAt, isStarred, originalPrompt, optimizedPrompt, responseTime')
      .eq('userId', user.id)
      .order('createdAt', { ascending: false })
      .limit(limit);

    // Optional: cursor-based pagination
    const cursor = url.searchParams.get('cursor');
    if (cursor) {
      query = query.lt('createdAt', cursor);
    }

    const { data: history, error: historyError } = await query;

    if (historyError) throw historyError;

    const res = NextResponse.json(history || []);
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    return res;
  } catch (error) {
    console.error("GET /api/history error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const token = getAuthToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized. Missing token." }, { status: 401 });

    const user = await getUser(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid Access Token." }, { status: 401 });
    }

    const body = await request.json();
    if (!body.originalPrompt || !body.optimizedPrompt) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const adminClient = getSupabaseAdmin();

    const MODE_MAP: Record<string, string | null> = {
      AUTO: null,
      GENERAL: "GENERAL",
      DEVELOPER: "DEVELOPER",
      DESIGNER: "DESIGNER",
      MARKETING: "MARKETING",
      RESEARCH: "RESEARCH",
      BUSINESS: "BUSINESS",
      CONTENT_CREATOR: "CONTENT_CREATOR",
      STARTUP_FOUNDER: "STARTUP_FOUNDER"
    };

    const LEVEL_MAP: Record<string, string | null> = {
      AUTO: null,
      LIGHT: "LIGHT",
      MEDIUM: "MEDIUM",
      AGGRESSIVE: "AGGRESSIVE",
      EXPERT: "EXPERT",
      BASIC: "BASIC",
      PROFESSIONAL: "PROFESSIONAL",
      "STAFF+": "STAFF_PLUS",
      "STAFF_PLUS": "STAFF_PLUS",
      RESEARCH: "RESEARCH",
      "PRODUCTION AUDIT": "PRODUCTION_AUDIT",
      "PRODUCTION_AUDIT": "PRODUCTION_AUDIT"
    };

    const rawMode = (body.promptMode || body.mode || "").toString().replace(/-/g, "_").toUpperCase();
    const rawLevel = (body.rewriteLevel || "").toString().toUpperCase();

    const promptMode = MODE_MAP[rawMode] ?? null;
    const rewriteLevel = LEVEL_MAP[rawLevel] ?? null;

    const payload = {
      id: crypto.randomUUID(),
      userId: user.id,
      originalPrompt: body.originalPrompt,
      optimizedPrompt: body.optimizedPrompt,
      platformUsed: body.platformUsed ?? "extension",
      promptMode,
      rewriteLevel,
      responseTime: Number(body.responseTime) || null,
      isStarred: false
    };

    let { data, error: insertError } = await adminClient.from('PromptHistory').insert(payload).select('id').single();

    if (insertError) {
      console.warn("[Promptly] Synced insert failed. Trying fallback mapping...", insertError.message);
      
      const fallbackLevels: Record<string, string> = {
        BASIC: 'LIGHT',
        PROFESSIONAL: 'MEDIUM',
        STAFF_PLUS: 'AGGRESSIVE',
        RESEARCH: 'EXPERT',
        PRODUCTION_AUDIT: 'EXPERT'
      };

      if (rewriteLevel && fallbackLevels[rewriteLevel]) {
        payload.rewriteLevel = fallbackLevels[rewriteLevel];
        const retryResult = await adminClient.from('PromptHistory').insert(payload).select('id').single();
        data = retryResult.data;
        insertError = retryResult.error;
      }
    }

    if (insertError || !data) {
      console.error("Supabase Insert Error:", insertError);
      return NextResponse.json({ error: "Failed to save entry. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error("POST /api/history error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE — remove a single history entry
export async function DELETE(request: Request) {
  try {
    const token = getAuthToken(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const user = await getUser(token);
    if (!user) return NextResponse.json({ error: 'Invalid Access Token.' }, { status: 401 });

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id query param.' }, { status: 400 });

    const adminClient = getSupabaseAdmin();

    const { error: deleteError } = await adminClient
      .from('PromptHistory')
      .delete()
      .eq('id', id)
      .eq('userId', user.id);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json({ error: 'Delete failed. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/history error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH — sync isStarred from extension to Supabase
export async function PATCH(request: Request) {
  try {
    const token = getAuthToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const user = await getUser(token);
    if (!user) return NextResponse.json({ error: "Invalid Access Token." }, { status: 401 });

    const body = await request.json();
    if (!body.id || typeof body.isStarred !== 'boolean') {
      return NextResponse.json({ error: "Missing id or isStarred" }, { status: 400 });
    }

    const adminClient = getSupabaseAdmin();

    const { error: updateError } = await adminClient
      .from('PromptHistory')
      .update({ isStarred: body.isStarred })
      .eq('id', body.id)
      .eq('userId', user.id);

    if (updateError) {
      console.error("Star sync error:", updateError);
      return NextResponse.json({ error: "Update failed. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/history error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
