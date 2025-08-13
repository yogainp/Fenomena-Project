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

    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const regionId = searchParams.get('regionId') || '';
    
    const offset = (page - 1) * limit;
    
    // Build Supabase query
    let query = supabase
      .from('catatan_survei')
      .select(`
        *,
        region:regions(id, province, city, regionCode),
        category:survey_categories(id, name, description),
        user:users(id, username)
      `, { count: 'exact' });
    
    // Apply filters
    if (search) {
      query = query.ilike('catatan', `%${search}%`);
    }
    
    if (categoryId) {
      query = query.eq('categoryId', categoryId);
    }
    
    if (regionId) {
      query = query.eq('regionId', regionId);
    }
    
    // Apply pagination and ordering
    query = query
      .order('nomorResponden', { ascending: true })
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: catatanSurvei, count: totalCount, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ 
        error: 'Database error',
        details: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({
      data: catatanSurvei || [],
      pagination: {
        page,
        limit,
        totalCount: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
      },
    });
    
  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Get catatan survei error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { catatan, regionId, categoryId, nomorResponden } = body;
    
    // Validate required fields
    if (!catatan || !regionId || !categoryId || nomorResponden === undefined) {
      return NextResponse.json(
        { error: 'Catatan, regionId, categoryId, dan nomorResponden harus diisi' },
        { status: 400 }
      );
    }
    
    // Convert and validate nomorResponden as integer
    const nomorRespondenInt = parseInt(nomorResponden, 10);
    if (isNaN(nomorRespondenInt) || nomorRespondenInt <= 0) {
      return NextResponse.json(
        { error: 'Nomor responden harus berupa angka positif' },
        { status: 400 }
      );
    }
    
    // Validate region exists
    const { data: region, error: regionError } = await supabase
      .from('regions')
      .select('id')
      .eq('id', regionId)
      .single();
    
    if (regionError || !region) {
      return NextResponse.json(
        { error: 'Region tidak ditemukan' },
        { status: 400 }
      );
    }
    
    // Validate category exists
    const { data: category, error: categoryError } = await supabase
      .from('survey_categories')
      .select('id')
      .eq('id', categoryId)
      .single();
    
    if (categoryError || !category) {
      return NextResponse.json(
        { error: 'Kategori tidak ditemukan' },
        { status: 400 }
      );
    }
    
    // Generate respondenId (without periodId)
    const respondenId = `${categoryId}-${nomorRespondenInt}`;
    
    // Insert catatan survei
    const { data: catatanSurvei, error: insertError } = await supabase
      .from('catatan_survei')
      .insert({
        id: crypto.randomUUID(),
        nomorResponden: nomorRespondenInt,
        respondenId,
        catatan,
        regionId,
        categoryId,
        userId: user.userId,
      })
      .select(`
        *,
        region:regions(id, province, city, regionCode),
        category:survey_categories(id, name, description),
        user:users(id, username)
      `)
      .single();

    if (insertError) {
      console.error('Insert catatan survei error:', insertError);
      return NextResponse.json({ 
        error: 'Failed to create catatan survei',
        details: insertError.message 
      }, { status: 500 });
    }
    
    return NextResponse.json(catatanSurvei, { status: 201 });
    
  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Create catatan survei error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}