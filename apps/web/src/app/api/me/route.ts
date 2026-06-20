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
        console.warn("Using placeholder Supabase URL. Bypassing auth for development.");
        return NextResponse.json({
          tier: 'expert',
          total_requests_today: 42,
          contextProfile: null
        });
      } else {
        return NextResponse.json({ error: "Invalid Access Token." }, { status: 401 });
      }
    }

    const supabaseUserClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Load Usage Stats
    let tier = 'free';
    let total_requests_today = 0;
    
    if (!supabaseUrl.includes('placeholder')) {
      const { data: statsData, error: statsError } = await supabaseUserClient
        .from('usage_stats')
        .select('*')
        .eq('id', user.id)
        .single();

      if (statsData) {
        tier = statsData.tier || 'free';
        total_requests_today = statsData.total_requests_today || 0;
      } else if (statsError && statsError.code === 'PGRST116') {
        // Fallback for missing row
        tier = 'free';
      }
    }

    // Try to load Extension Profile context
    let contextProfile = null;
    if (!supabaseUrl.includes('placeholder')) {
      const { data: profileData, error: profileError } = await supabaseUserClient
        .from('ContextProfile')
        .select('*')
        .eq('userId', user.id)
        .eq('name', 'Extension Profile')
        .single();
      
      contextProfile = profileData;
    }

    return NextResponse.json({
      tier,
      total_requests_today,
      contextProfile: contextProfile ? {
        companyName: contextProfile.companyName,
        websiteUrl: contextProfile.websiteURL, // Maps from Prisma websiteURL to frontend websiteUrl
        industry: contextProfile.industry,
        audience: contextProfile.audience,
        writingStyle: contextProfile.writingStyle,
        brandTone: contextProfile.brandTone,
      } : null
    });

  } catch (error) {
    console.error("GET /api/me error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
