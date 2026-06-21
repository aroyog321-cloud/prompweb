import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key';
const supabase = createClient(supabaseUrl, supabaseKey);

function getAuthToken(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

async function getUser(token: string) {
  const { data: { user }, error } = await supabase.auth.getUser(token);
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

    const supabaseUserClient = createClient(supabaseUrl, supabaseKey, {
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

    const supabaseUserClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data, error: insertError } = await supabaseUserClient.from('PromptHistory').insert({
      id: crypto.randomUUID(),
      userId: user.id,
      originalPrompt: body.originalPrompt,
      optimizedPrompt: body.optimizedPrompt,
      platformUsed: body.platformUsed || "api",
      promptMode: body.promptMode ? body.promptMode.replace(/-/g, '_').toUpperCase() : null,
      rewriteLevel: body.rewriteLevel ? body.rewriteLevel.toUpperCase() : null,
      responseTime: body.responseTime || null,
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

    const supabaseUserClient = createClient(supabaseUrl, supabaseKey, {
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
