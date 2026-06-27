export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { requireEnv } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized. Missing token." }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    const { data: { user }, error: authError } = await getSupabaseAdmin().auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid Access Token." }, { status: 401 });
    }

    if (!user) {
       return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const body = await request.json();
    const { contextProfile } = body;

    if (!contextProfile) {
      return NextResponse.json({ error: "Missing contextProfile" }, { status: 400 });
    }

    // See if an "Extension Profile" already exists for this user
    const { data: existingProfiles } = await supabaseUserClient
      .from('ContextProfile')
      .select('id')
      .eq('userId', user.id)
      .eq('name', 'Extension Profile')
      .limit(1);

    const isExisting = existingProfiles && existingProfiles.length > 0;

    const MAX_FIELD = 500;
    const sanitize = (v: unknown) => typeof v === 'string' ? v.slice(0, MAX_FIELD) : null;

    const payload = {
      userId: user.id,
      name: 'Extension Profile',
      isDefault: true,
      companyName: sanitize(contextProfile.companyName),
      websiteURL: sanitize(contextProfile.websiteUrl),
      industry: sanitize(contextProfile.industry),
      audience: sanitize(contextProfile.audience),
      writingStyle: sanitize(contextProfile.writingStyle),
      brandTone: sanitize(contextProfile.brandTone),
    };

    if (isExisting) {
      const { error } = await supabaseUserClient
        .from('ContextProfile')
        .update(payload)
        .eq('id', existingProfiles[0].id);
      
      if (error) throw error;
    } else {
      const { error } = await supabaseUserClient
        .from('ContextProfile')
        .insert(payload);
      
      if (error) throw error;
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Contexts sync error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized. Missing token." }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    const { data: { user }, error: authError } = await getSupabaseAdmin().auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid Access Token." }, { status: 401 });
    }

    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: profiles, error: profilesError } = await supabaseUserClient
      .from('ContextProfile')
      .select('*')
      .eq('userId', user.id);

    if (profilesError) throw profilesError;

    const mappedProfiles = (profiles || []).map(p => ({
      ...p,
      websiteUrl: p.websiteURL, // Map Prisma schema to frontend expected
    }));

    const res = NextResponse.json(mappedProfiles);
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    return res;
  } catch (error) {
    console.error("GET /api/contexts error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

