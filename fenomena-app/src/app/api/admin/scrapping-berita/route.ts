import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/middleware';
import { z } from 'zod';

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

    // Build where conditions
    const whereConditions: any = {};
    
    if (search) {
      whereConditions.OR = [
        { judul: { contains: search, mode: 'insensitive' } },
        { isi: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (portal) {
      whereConditions.portalBerita = { contains: portal, mode: 'insensitive' };
    }

    if (dateFrom || dateTo) {
      whereConditions.tanggalBerita = {};
      if (dateFrom) {
        whereConditions.tanggalBerita.gte = new Date(dateFrom);
      }
      if (dateTo) {
        whereConditions.tanggalBerita.lte = new Date(dateTo + 'T23:59:59.999Z');
      }
    }

    if (keyword) {
      whereConditions.matchedKeywords = {
        hasSome: [keyword],
      };
    }

    // Get news with pagination
    const [beritaList, totalBerita] = await Promise.all([
      prisma.scrappingBerita.findMany({
        where: whereConditions,
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
          _count: {
            select: {
              analysisResults: true,
            },
          },
        },
        orderBy: { tanggalBerita: 'desc' },
        skip,
        take: limit,
      }),
      prisma.scrappingBerita.count({ where: whereConditions }),
    ]);

    const totalPages = Math.ceil(totalBerita / limit);

    return NextResponse.json({
      berita: beritaList.map(item => ({
        ...item,
        isi: item.isi.substring(0, 200) + (item.isi.length > 200 ? '...' : ''), // Truncate content for list view
        analysisCount: item._count.analysisResults,
        _count: undefined,
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalBerita,
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
    const existingBerita = await prisma.scrappingBerita.findUnique({
      where: { idBerita },
    });

    if (existingBerita) {
      return NextResponse.json({
        error: 'News already exists',
        berita: existingBerita,
      }, { status: 409 });
    }

    // Create news
    const newBerita = await prisma.scrappingBerita.create({
      data: {
        idBerita,
        portalBerita,
        linkBerita,
        judul,
        isi,
        tanggalBerita: new Date(tanggalBerita),
        matchedKeywords,
      },
    });

    // Update match count for matched keywords
    if (matchedKeywords && matchedKeywords.length > 0) {
      await prisma.scrappingKeyword.updateMany({
        where: {
          keyword: { in: matchedKeywords },
        },
        data: {
          matchCount: { increment: 1 },
        },
      });
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
    const deletedBerita = await prisma.scrappingBerita.deleteMany({
      where: {
        id: { in: beritaIds },
      },
    });

    return NextResponse.json({
      message: `Deleted ${deletedBerita.count} news items successfully`,
      deletedCount: deletedBerita.count,
    });

  } catch (error: any) {
    console.error('Bulk delete berita error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}