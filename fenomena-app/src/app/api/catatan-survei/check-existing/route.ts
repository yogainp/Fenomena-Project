import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    console.log('=== Check Existing API Called ===');
    
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

    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('User authenticated:', user);
    const body = await request.json();
    console.log('Request body:', body);
    
    const { categoryId } = body;
    
    // Validate required fields
    if (!categoryId) {
      return NextResponse.json(
        { error: 'CategoryId harus diisi' },
        { status: 400 }
      );
    }
    
    // Validate category exists
    console.log('Finding category with ID:', categoryId);
    const { data: category, error: categoryError } = await supabase
      .from('survey_categories')
      .select('id, name')
      .eq('id', categoryId)
      .single();
      
    console.log('Category found:', category);
    
    if (categoryError || !category) {
      console.log('Category not found for ID:', categoryId);
      return NextResponse.json(
        { error: 'Kategori tidak ditemukan' },
        { status: 400 }
      );
    }
    
    // Check existing data - get most recent record
    const { data: existingData, error: existingError } = await supabase
      .from('catatan_survei')
      .select(`
        id,
        createdAt,
        user:users(username)
      `)
      .eq('categoryId', categoryId)
      .order('createdAt', { ascending: false })
      .limit(1);

    // Get count of existing data
    const { count: existingCount, error: countError } = await supabase
      .from('catatan_survei')
      .select('*', { count: 'exact', head: true })
      .eq('categoryId', categoryId);

    if (existingError || countError) {
      console.error('Error fetching existing data:', existingError || countError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Get regions distribution using aggregation
    const { data: regionStats, error: regionError } = await supabase
      .from('catatan_survei')
      .select(`
        regionId,
        region:regions(id, province, city)
      `)
      .eq('categoryId', categoryId);

    if (regionError) {
      console.error('Error fetching region distribution:', regionError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Process region stats manually since Supabase doesn't have groupBy
    const regionMap = new Map();
    (regionStats || []).forEach(item => {
      const regionId = item.regionId;
      if (!regionMap.has(regionId)) {
        regionMap.set(regionId, {
          region: item.region,
          count: 0
        });
      }
      regionMap.get(regionId).count++;
    });

    const processedRegionStats = Array.from(regionMap.values());
    
    return NextResponse.json({
      hasExistingData: (existingCount || 0) > 0,
      existingCount: existingCount || 0,
      lastUploadedBy: (existingData as any)?.[0]?.user?.username || null,
      lastUploadedAt: existingData?.[0]?.createdAt || null,
      categoryName: category.name,
      regionStats: processedRegionStats,
    });
    
  } catch (error: any) {
    console.error('=== Check Existing API Error ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error:', error);
    
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Check existing data error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}