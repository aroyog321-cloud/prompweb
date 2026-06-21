import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized. Missing token." }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      if (supabaseUrl.includes('placeholder')) {
        return NextResponse.json([]);
      } else {
        return NextResponse.json({ error: "Invalid Access Token." }, { status: 401 });
      }
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
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized. Missing token." }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      if (supabaseUrl.includes('placeholder')) {
        return NextResponse.json({ success: true, message: "Mocked locally" });
      } else {
        return NextResponse.json({ error: "Invalid Access Token." }, { status: 401 });
      }
    }

    const body = await request.json();
    if (!body.originalPrompt || !body.optimizedPrompt) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabaseUserClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { error: insertError } = await supabaseUserClient.from('PromptHistory').insert({
      userId: user.id,
      originalPrompt: body.originalPrompt,
      optimizedPrompt: body.optimizedPrompt,
      platformUsed: body.platformUsed || "api",
      promptMode: body.promptMode ? body.promptMode.replace(/-/g, '_').toUpperCase() : null,
      rewriteLevel: body.rewriteLevel ? body.rewriteLevel.toUpperCase() : null,
      responseTime: body.responseTime || null
    });

    if (insertError) throw insertError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/history error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
