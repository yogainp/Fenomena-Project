import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/middleware';
import { scrapeNewsFromPortal } from '@/lib/scraping-service';
import { z } from 'zod';

// Allowed portals
const ALLOWED_PORTALS = [
  'https://pontianakpost.jawapos.com/daerah',
  'https://kalbaronline.com/berita-daerah/',
  'https://kalbar.antaranews.com/kalbar'
];

const executeScrapingSchema = z.object({
  portalUrl: z.string().url('Invalid portal URL').refine(
    (url) => ALLOWED_PORTALS.includes(url),
    {
      message: `Portal URL must be one of: ${ALLOWED_PORTALS.join(', ')}`
    }
  ),
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
    console.log('GET /api/admin/scrapping-berita/execute - Starting...');
    
    // Check authentication
    const user = requireRole(request, 'ADMIN');
    console.log('✓ User authenticated:', user.userId, user.role);

    console.log('Fetching statistics...');
    
    // Get scraping statistics with individual error handling
    let totalNews = 0;
    let todayNews = 0;
    let totalKeywords = 0;
    let activeKeywords = 0;
    
    try {
      totalNews = await prisma.scrappingBerita.count();
      console.log('✓ Total news:', totalNews);
    } catch (err) {
      console.error('Error getting total news:', err);
    }
    
    try {
      todayNews = await prisma.scrappingBerita.count({
        where: {
          tanggalScrap: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      });
      console.log('✓ Today news:', todayNews);
    } catch (err) {
      console.error('Error getting today news:', err);
    }
    
    try {
      totalKeywords = await prisma.scrappingKeyword.count();
      console.log('✓ Total keywords:', totalKeywords);
    } catch (err) {
      console.error('Error getting total keywords:', err);
    }
    
    try {
      activeKeywords = await prisma.scrappingKeyword.count({
        where: { isActive: true },
      });
      console.log('✓ Active keywords:', activeKeywords);
    } catch (err) {
      console.error('Error getting active keywords:', err);
    }

    // Get recent scraping activity
    let recentNews = [];
    try {
      recentNews = await prisma.scrappingBerita.findMany({
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
      console.log('✓ Recent news:', recentNews.length);
    } catch (err) {
      console.error('Error getting recent news:', err);
    }

    const response = {
      statistics: {
        totalNews,
        todayNews,
        totalKeywords,
        activeKeywords,
      },
      recentActivity: recentNews,
    };
    
    console.log('✓ Returning response:', JSON.stringify(response, null, 2));
    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Get scraping status error:', error);
    console.error('Error stack:', error.stack);
    
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}