import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireRole } from '@/lib/middleware';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const createBeritaSchema = z.object({
  idBerita: z.string().min(1, 'ID Berita cannot be empty'),
  portalBerita: z.string().min(1, 'Portal Berita cannot be empty'),
  linkBerita: z.string().url('Invalid URL format'),
  judul: z.string().min(1, 'Judul cannot be empty'),
  isi: z.string().min(1, 'Isi cannot be empty'),
  tanggalBerita: z.string().datetime('Invalid date format'),
  matchedKeywords: z.array(z.string()).optional().default([]),
});

// GET /api/admin/scrapping-berita - List all scraped news
export async function GET(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const portal = searchParams.get('portal') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const keyword = searchParams.get('keyword') || '';

    const skip = (page - 1) * limit;

    // Build Supabase query
    let query = supabase
      .from('scrapping_berita')
      .select('*', { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.or(`judul.ilike.%${search}%,isi.ilike.%${search}%`);
    }
    if (portal) {
      query = query.ilike('portalBerita', `%${portal}%`);
    }
    if (dateFrom) {
      query = query.gte('tanggalBerita', new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      query = query.lte('tanggalBerita', new Date(dateTo + 'T23:59:59.999Z').toISOString());
    }
    if (keyword) {
      query = query.contains('matchedKeywords', [keyword]);
    }

    // Apply ordering and pagination
    query = query
      .order('tanggalBerita', { ascending: false })
      .range(skip, skip + limit - 1);

    const { data: beritaList, error, count: totalBerita } = await query;
    
    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    const totalPages = Math.ceil((totalBerita || 0) / limit);

    return NextResponse.json({
      berita: (beritaList || []).map(item => ({
        ...item,
        isi: item.isi.substring(0, 200) + (item.isi.length > 200 ? '...' : ''), // Truncate content for list view
        analysisCount: 0, // TODO: Add analysis count from supabase if needed
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalBerita: totalBerita || 0,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });

  } catch (error: any) {
    console.error('Get berita error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/scrapping-berita - Create new scraped news (used by scraping service)
export async function POST(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    const body = await request.json();
    const validationResult = createBeritaSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      }, { status: 400 });
    }

    const { idBerita, portalBerita, linkBerita, judul, isi, tanggalBerita, matchedKeywords } = validationResult.data;

    // Check if news already exists
    const { data: existingBerita } = await supabase
      .from('scrapping_berita')
      .select('*')
      .eq('idBerita', idBerita)
      .single();

    if (existingBerita) {
      return NextResponse.json({
        error: 'News already exists',
        berita: existingBerita,
      }, { status: 409 });
    }

    // Create news
    const { data: newBerita, error: createError } = await supabase
      .from('scrapping_berita')
      .insert({
        id: randomUUID(),
        idBerita,
        portalBerita,
        linkBerita,
        judul,
        isi,
        tanggalBerita: new Date(tanggalBerita).toISOString(),
        matchedKeywords,
        tanggalScrap: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();
      
    if (createError) {
      console.error('Error creating berita:', createError);
      throw createError;
    }

    // Update match count for matched keywords using helper function
    if (matchedKeywords && matchedKeywords.length > 0) {
      const { incrementKeywordMatchCount } = await import('@/lib/supabase-helpers');
      try {
        await incrementKeywordMatchCount(matchedKeywords);
      } catch (err) {
        console.warn('Error updating keyword match count:', err);
      }
    }

    return NextResponse.json({
      message: 'News created successfully',
      berita: newBerita,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create berita error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/scrapping-berita - Bulk delete scraped news
export async function DELETE(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    const body = await request.json();
    const { beritaIds } = body;

    if (!Array.isArray(beritaIds) || beritaIds.length === 0) {
      return NextResponse.json({
        error: 'beritaIds must be a non-empty array',
      }, { status: 400 });
    }

    // Delete news
    const { error: deleteError } = await supabase
      .from('scrapping_berita')
      .delete()
      .in('id', beritaIds);
      
    if (deleteError) {
      console.error('Error deleting berita:', deleteError);
      throw deleteError;
    }

    return NextResponse.json({
      message: `Deleted ${beritaIds.length} news items successfully`,
      deletedCount: beritaIds.length,
    });

  } catch (error: any) {
    console.error('Bulk delete berita error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}