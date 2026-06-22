import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

function getAuthToken(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

async function getUser(token: string) {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error) console.error("getUser error:", error);
  return error ? null : user;
}

export async function GET(request: Request) {
  try {
    const token = getAuthToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized. Missing token." }, { status: 401 });

    const user = await getUser(token);
    if (!user) {
      if (supabaseUrl.includes('placeholder')) return NextResponse.json([]);
      return NextResponse.json({ error: "Invalid Access Token." }, { status: 401 });
    }

    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    const { data: history, error: historyError } = await supabaseUserClient
      .from('PromptHistory')
      .select('*')
      .eq('userId', user.id)
      .order('createdAt', { ascending: false })
      .limit(limit);

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
      if (supabaseUrl.includes('placeholder')) return NextResponse.json({ success: true, message: "Mocked locally" });
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
      EXPERT: "EXPERT"
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
      return NextResponse.json({ error: "Supabase Insert Error", details: insertError }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error("POST /api/history error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
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
      return NextResponse.json({ error: "Update failed", details: updateError }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/history error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
