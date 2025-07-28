import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/middleware';
import { scrapeNewsFromPortal } from '@/lib/scraping-service';
import { z } from 'zod';

const executeScrapingSchema = z.object({
  portalUrl: z.string().url('Invalid portal URL'),
  maxPages: z.number().min(1).max(50).optional().default(10),
  delayMs: z.number().min(1000).max(10000).optional().default(2000),
});

// POST /api/admin/scrapping-berita/execute - Execute scraping process
export async function POST(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    const body = await request.json();
    const validationResult = executeScrapingSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      }, { status: 400 });
    }

    const { portalUrl, maxPages, delayMs } = validationResult.data;

    // Execute scraping (this will be implemented in scraping-service)
    const scrapingResult = await scrapeNewsFromPortal({
      portalUrl,
      maxPages,
      delayMs,
    });

    return NextResponse.json({
      message: 'Scraping executed successfully',
      result: scrapingResult,
    });

  } catch (error: any) {
    console.error('Execute scraping error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message.includes('scraping')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/admin/scrapping-berita/execute - Get scraping status/statistics
export async function GET(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    // Get scraping statistics
    const [totalNews, todayNews, totalKeywords, activeKeywords] = await Promise.all([
      prisma.scrappingBerita.count(),
      prisma.scrappingBerita.count({
        where: {
          tanggalScrap: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.scrappingKeyword.count(),
      prisma.scrappingKeyword.count({
        where: { isActive: true },
      }),
    ]);

    // Get recent scraping activity
    const recentNews = await prisma.scrappingBerita.findMany({
      select: {
        id: true,
        judul: true,
        portalBerita: true,
        tanggalScrap: true,
        matchedKeywords: true,
      },
      orderBy: { tanggalScrap: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      statistics: {
        totalNews,
        todayNews,
        totalKeywords,
        activeKeywords,
      },
      recentActivity: recentNews,
    });

  } catch (error: any) {
    console.error('Get scraping status error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}