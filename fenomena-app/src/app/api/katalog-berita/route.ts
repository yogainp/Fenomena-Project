import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/katalog-berita - Get news catalog for public access
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const portal = searchParams.get('portal') || '';
    const keyword = searchParams.get('keyword') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    const offset = (page - 1) * limit;

    // Build Supabase query
    let query = supabase.from('scrapping_berita').select('*', { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.or(`judul.ilike.%${search}%,isi.ilike.%${search}%`);
    }

    if (portal) {
      query = query.eq('portalBerita', portal);
    }

    if (keyword) {
      query = query.contains('matchedKeywords', [keyword]);
    }

    if (dateFrom) {
      query = query.gte('tanggalBerita', dateFrom);
    }

    if (dateTo) {
      query = query.lte('tanggalBerita', dateTo + 'T23:59:59.999Z');
    }

    // Apply pagination and ordering
    query = query
      .order('tanggalBerita', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: berita, count: totalBerita, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ 
        error: 'Database error',
        details: error.message 
      }, { status: 500 });
    }

    // Calculate pagination
    const totalPages = Math.ceil((totalBerita || 0) / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      berita: (berita || []).map(item => ({
        ...item,
        // Truncate content for list view
        isi: (item as any).isi && ((item as any).isi as string).length > 200 ? ((item as any).isi as string).substring(0, 200) + '...' : (item as any).isi,
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalBerita: totalBerita || 0,
        hasNextPage,
        hasPrevPage,
      },
    });

  } catch (error: unknown) {
    console.error('Get katalog berita error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      error: 'Internal server error',
      details: errorMessage 
    }, { status: 500 });
  }
}