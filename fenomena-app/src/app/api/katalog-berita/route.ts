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

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, any> = {};

    if (search) {
      where.OR = [
        { judul: { contains: search, mode: 'insensitive' } },
        { isi: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (portal) {
      where.portalBerita = { contains: portal, mode: 'insensitive' };
    }

    if (keyword) {
      where.matchedKeywords = { has: keyword };
    }

    if (dateFrom || dateTo) {
      where.tanggalBerita = {};
      if (dateFrom) {
        where.tanggalBerita.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.tanggalBerita.lte = new Date(dateTo + 'T23:59:59.999Z');
      }
    }

    // Get total count
    const totalBerita = await prisma.scrappingBerita.count({ where });

    // Get news data
    const berita = await prisma.scrappingBerita.findMany({
      where,
      select: {
        id: true,
        idBerita: true,
        portalBerita: true,
        linkBerita: true,
        judul: true,
        isi: true,
        tanggalBerita: true,
        tanggalScrap: true,
        matchedKeywords: true,
        createdAt: true,
      },
      orderBy: { tanggalBerita: 'desc' },
      skip,
      take: limit,
    });

    // Calculate pagination
    const totalPages = Math.ceil(totalBerita / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      berita: berita.map(item => ({
        ...item,
        tanggalBerita: item.tanggalBerita.toISOString(),
        tanggalScrap: item.tanggalScrap.toISOString(),
        createdAt: item.createdAt.toISOString(),
        // Truncate content for list view
        isi: item.isi.length > 200 ? item.isi.substring(0, 200) + '...' : item.isi,
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalBerita,
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