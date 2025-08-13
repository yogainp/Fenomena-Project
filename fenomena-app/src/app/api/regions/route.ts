import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/middleware';

// GET /api/regions - Get all regions for dropdown selection
export async function GET(request: NextRequest) {
  try {
    // Remove auth requirement for registration page access

    const { data: regions, error } = await supabase
      .from('regions')
      .select('id, province, city, regionCode')
      .order('province', { ascending: true })
      .order('city', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch regions' }, { status: 500 });
    }

    return NextResponse.json({ regions });

  } catch (error: any) {
    console.error('Get regions error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}