import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireRole } from '@/lib/middleware';
import { scrapeNewsFromPortal } from '@/lib/scraping-service';
import { z } from 'zod';

// Allowed portals
const ALLOWED_PORTALS = [
  'https://pontianakpost.jawapos.com/daerah',
  'https://kalbaronline.com/berita-daerah/',
  'https://kalbar.antaranews.com/kalbar',
  'https://www.suarakalbar.co.id/category/kalbar/'
];

const executeScrapingSchema = z.object({
  portalUrl: z.string().url('Invalid portal URL').refine(
    (url) => ALLOWED_PORTALS.includes(url),
    {
      message: `Portal URL must be one of: ${ALLOWED_PORTALS.join(', ')}`
    }
  ),
  maxPages: z.number().min(1).max(200).optional().default(10),
  delayMs: z.number().min(1000).max(10000).optional().default(2000),
  scrapingEngine: z.enum(['axios', 'chromium']).optional().default('axios'),
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
        details: validationResult.error.issues,
      }, { status: 400 });
    }

    const { portalUrl, maxPages, delayMs, scrapingEngine } = validationResult.data;

    // Validate chromium usage
    if (scrapingEngine === 'chromium') {
      // Check if portal is supported for Chromium scraping
      const isKalbarOnline = portalUrl.includes('kalbaronline.com');
      const isPontianakPost = portalUrl.includes('pontianakpost.jawapos.com');
      
      if (!isKalbarOnline && !isPontianakPost) {
        return NextResponse.json({
          error: 'Chromium scraping is currently only supported for Kalbar Online and Pontianak Post',
          details: 'Please use Axios scraping for other portals.',
        }, { status: 400 });
      }
      
      console.log(`[API] 🚀 Chromium scraping enabled for ${portalUrl} (Environment: ${process.env.NODE_ENV || 'unknown'})`);
    }

    let scrapingResult;
    
    try {
      // Execute scraping based on engine
      if (scrapingEngine === 'chromium') {
        console.log(`[API] Using Chromium scraping for ${portalUrl}`);
        
        try {
          // Dynamic import to avoid bundling chromium dependencies in production
          const chromiumService = await import('@/lib/chromium-scraping-service');
          
          // Route to appropriate scraping function based on portal
          if (portalUrl.includes('kalbaronline.com')) {
            scrapingResult = await chromiumService.scrapeKalbarOnlineWithChromium({
              portalUrl,
              maxViewMoreClicks: Math.max(0, maxPages - 1),
              keywords: [], // Will be fetched from database
              delayMs,
            });
          } else if (portalUrl.includes('pontianakpost.jawapos.com')) {
            scrapingResult = await chromiumService.scrapePontianakPostWithChromium({
              portalUrl,
              maxPages,
              keywords: [], // Will be fetched from database
              delayMs,
            });
          }
        } catch (dynamicImportError: any) {
          console.error('[API] Failed to load chromium scraping service:', dynamicImportError);
          return NextResponse.json({
            error: 'Chromium scraping service unavailable',
            details: 'Failed to load chromium dependencies. This usually happens in production environments where puppeteer is not available.',
            suggestion: 'Use Axios scraping instead, or ensure you are running in development mode with puppeteer installed.',
          }, { status: 503 });
        }
      } else {
        console.log(`[API] Using Axios scraping for ${portalUrl}`);
        scrapingResult = await scrapeNewsFromPortal({
          portalUrl,
          maxPages,
          delayMs,
        });
      }
    } catch (executionError: any) {
      // Handle execution errors
      console.error('[API] Scraping execution error:', executionError);
      return NextResponse.json({
        error: 'Scraping execution failed',
        details: executionError.message || 'An error occurred during scraping execution.',
      }, { status: 500 });
    }

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
      const { count } = await supabase
        .from('scrapping_berita')
        .select('*', { count: 'exact', head: true });
      totalNews = count || 0;
      console.log('✓ Total news:', totalNews);
    } catch (err) {
      console.error('Error getting total news:', err);
    }
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('scrapping_berita')
        .select('*', { count: 'exact', head: true })
        .gte('tanggalScrap', today.toISOString());
      todayNews = count || 0;
      console.log('✓ Today news:', todayNews);
    } catch (err) {
      console.error('Error getting today news:', err);
    }
    
    try {
      const { count } = await supabase
        .from('scrapping_keywords')
        .select('*', { count: 'exact', head: true });
      totalKeywords = count || 0;
      console.log('✓ Total keywords:', totalKeywords);
    } catch (err) {
      console.error('Error getting total keywords:', err);
    }
    
    try {
      const { count } = await supabase
        .from('scrapping_keywords')
        .select('*', { count: 'exact', head: true })
        .eq('isActive', true);
      activeKeywords = count || 0;
      console.log('✓ Active keywords:', activeKeywords);
    } catch (err) {
      console.error('Error getting active keywords:', err);
    }

    // Get recent scraping activity
    let recentNews: any[] = [];
    try {
      const { data } = await supabase
        .from('scrapping_berita')
        .select('id, judul, portalBerita, tanggalScrap, matchedKeywords')
        .order('tanggalScrap', { ascending: false })
        .limit(10);
      recentNews = data || [];
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