import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Get auth token from cookie
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify token
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    console.log('Simple analytics request by user:', user.userId);

    // Get basic counts using Supabase
    const [
      { count: totalPhenomena },
      { count: totalCategories },
      { count: totalUsers },
      { count: totalRegions }
    ] = await Promise.all([
      supabase.from('phenomena').select('*', { count: 'exact', head: true }),
      supabase.from('survey_categories').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('regions').select('*', { count: 'exact', head: true })
    ]);

    // Get categories with phenomena counts
    const { data: categories } = await supabase
      .from('survey_categories')
      .select('*');

    // Get phenomena distribution by category
    const categoryDistribution = categories ? await Promise.all(
      categories.map(async (category: any) => {
        const { count } = await supabase
          .from('phenomena')
          .select('*', { count: 'exact', head: true })
          .eq('categoryId', category.id);
        return { 
          name: category.name, 
          count: count || 0 
        };
      })
    ) : [];

    // Get user distribution by region
    const { data: regions } = await supabase
      .from('regions')
      .select('*');

    const regionDistribution = regions ? await Promise.all(
      regions.map(async (region: any) => {
        const { count } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('regionId', region.id);
        return { 
          region: `${region.city}, ${region.province}`, 
          count: count || 0 
        };
      })
    ) : [];

    console.log('Counts:', { totalPhenomena, totalCategories, totalUsers, totalRegions });

    return NextResponse.json({
      overview: {
        totalPhenomena: totalPhenomena || 0,
        totalCategories: totalCategories || 0,
        totalPeriods: totalCategories || 0, // Simplified
        totalUsers: totalUsers || 0,
        totalRegions: totalRegions || 0,
      },
      categoryDistribution: categoryDistribution.slice(0, 10),
      regionDistribution: regionDistribution.slice(0, 10),
      // Simplified recent phenomena
      recentPhenomena: []
    });

  } catch (error: any) {
    console.error('Simple analytics error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}