import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

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

    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const url = new URL(request.url);
    const rawLimit = parseInt(url.searchParams.get('limit') || '30', 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 30;

    let query = supabaseUserClient
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

    return NextResponse.json(history || []);
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

    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

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
      // Legacy to New mappings
      BASIC: "LIGHT",
      PROFESSIONAL: "MEDIUM",
      "STAFF+": "AGGRESSIVE",
      RESEARCH: "EXPERT",
      "PRODUCTION AUDIT": "EXPERT"
    };

    const rawMode = (body.promptMode || body.mode || "").toString().replace(/-/g, "_").toUpperCase();
    const rawLevel = (body.rewriteLevel || "").toString().toUpperCase();

    const promptMode = MODE_MAP[rawMode] ?? null;
    const rewriteLevel = LEVEL_MAP[rawLevel] ?? null;

    const { data, error: insertError } = await supabaseUserClient.from('PromptHistory').insert({
      id: crypto.randomUUID(),
      userId: user.id,
      originalPrompt: body.originalPrompt,
      optimizedPrompt: body.optimizedPrompt,
      platformUsed: body.platformUsed ?? "extension",
      promptMode,
      rewriteLevel,
      responseTime: Number(body.responseTime) || null,
      isStarred: false
    }).select('id').single();

    if (insertError) {
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

    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { error: deleteError } = await supabaseUserClient
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

    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { error: updateError } = await supabaseUserClient
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
