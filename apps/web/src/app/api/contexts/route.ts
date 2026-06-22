import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

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
        console.warn("Using placeholder Supabase URL. Bypassing auth for development.");
      } else {
        return NextResponse.json({ error: "Invalid Access Token." }, { status: 401 });
      }
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

    const payload = {
      userId: user.id,
      name: 'Extension Profile',
      isDefault: true,
      companyName: contextProfile.companyName || null,
      websiteURL: contextProfile.websiteUrl || null,
      industry: contextProfile.industry || null,
      audience: contextProfile.audience || null,
      writingStyle: contextProfile.writingStyle || null,
      brandTone: contextProfile.brandTone || null,
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

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      if (supabaseUrl.includes('placeholder')) {
        return NextResponse.json([]);
      } else {
        return NextResponse.json({ error: "Invalid Access Token." }, { status: 401 });
      }
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

    return NextResponse.json(mappedProfiles);
  } catch (error) {
    console.error("GET /api/contexts error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

