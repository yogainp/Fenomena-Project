import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireRole } from '@/lib/middleware';

// GET /api/admin/scrapping-keywords/active - Get all active keywords
export async function GET(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || '';

    // Build Supabase query
    let query = supabase
      .from('scrapping_keywords')
      .select('id, keyword, category, description, matchCount')
      .eq('isActive', true);
    
    if (category) {
      query = query.ilike('category', `%${category}%`);
    }

    // Get active keywords
    const { data: activeKeywords, error } = await query
      .order('matchCount', { ascending: false })
      .order('keyword', { ascending: true });
      
    if (error) {
      console.error('Error fetching active keywords:', error);
      throw error;
    }

    return NextResponse.json({
      keywords: activeKeywords || [],
      total: activeKeywords?.length || 0,
    });

  } catch (error: any) {
    console.error('Get active keywords error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}