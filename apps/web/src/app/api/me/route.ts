import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { requireEnv } from '@/lib/env';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey || 'dummy');

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized. Missing token." }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Load Usage Stats
    let tier = 'free';
    let total_requests_today = 0;
    
    if (user) {
      // Use the admin client (supabase) instead of supabaseUserClient to bypass RLS
      const { data: statsData, error: statsError } = await supabase
        .from('usage_stats')
        .select('*')
        .eq('id', user.id)
        .single();

      if (statsData) {
        tier = statsData.tier || 'expert';
        total_requests_today = statsData.total_requests_today || 0;
        
        // Auto-upgrade existing free users to expert
        if (tier === 'free') {
          tier = 'expert';
          await supabase.from('usage_stats').update({ tier: 'expert' }).eq('id', user.id);
        }
      } else if (statsError && statsError.code === 'PGRST116') {
        // Fallback for missing row
        tier = 'expert';
      }
    }

    // Try to load Extension Profile context
    let contextProfile = null;
    if (user) {
      // Use the admin client (supabase) instead of supabaseUserClient to bypass RLS
      const { data: profileData } = await supabase
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
