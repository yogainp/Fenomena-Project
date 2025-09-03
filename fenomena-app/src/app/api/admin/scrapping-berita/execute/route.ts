import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireRole } from '@/lib/middleware';
// Import chromium scraping functions directly
import { 
  scrapeKalbarOnlineWithChromium, 
  scrapePontianakPostWithChromium, 
  scrapeTribunPontianakWithChromium, 
  scrapeKalbarAntaranewsWithChromium,
  scrapeSuaraKalbarWithChromium
} from '@/lib/chromium-scraping-service';
import { z } from 'zod';

// Allowed portals (All use Chromium browser automation)
const ALLOWED_PORTALS = [
  'https://pontianakpost.jawapos.com/daerah',
  'https://kalbaronline.com/berita-daerah/',
  'https://kalbar.antaranews.com/kalbar',
  'https://pontianak.tribunnews.com/index-news/kalbar',
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
  // Removed scrapingEngine - always use Chromium now
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

    const { portalUrl, maxPages, delayMs } = validationResult.data;

    console.log(`[API] 🚀 Using Chromium scraping for ${portalUrl} (Environment: ${process.env.NODE_ENV || 'unknown'})`);

    let scrapingResult;
    
    try {
      // Route to appropriate chromium scraping function based on portal
      if (portalUrl.includes('kalbaronline.com')) {
        console.log('[API] Executing Kalbar Online Chromium scraping...');
        scrapingResult = await scrapeKalbarOnlineWithChromium({
          portalUrl,
          maxViewMoreClicks: Math.max(0, maxPages - 1),
          keywords: [], // Will be fetched from database
          delayMs,
        });
      } else if (portalUrl.includes('pontianakpost.jawapos.com')) {
        console.log('[API] Executing Pontianak Post Chromium scraping...');
        scrapingResult = await scrapePontianakPostWithChromium({
          portalUrl,
          maxPages,
          keywords: [], // Will be fetched from database
          delayMs,
        });
      } else if (portalUrl.includes('pontianak.tribunnews.com')) {
        console.log('[API] Executing Tribun Pontianak Chromium scraping...');
        scrapingResult = await scrapeTribunPontianakWithChromium({
          portalUrl,
          maxPages,
          keywords: [], // Will be fetched from database
          delayMs,
        });
      } else if (portalUrl.includes('kalbar.antaranews.com')) {
        console.log('[API] Executing Antara News Kalbar Chromium scraping...');
        scrapingResult = await scrapeKalbarAntaranewsWithChromium({
          portalUrl,
          maxPages,
          keywords: [], // Will be fetched from database
          delayMs,
        });
      } else if (portalUrl.includes('suarakalbar.co.id')) {
        console.log('[API] Executing Suara Kalbar Chromium scraping...');
        scrapingResult = await scrapeSuaraKalbarWithChromium({
          portalUrl,
          maxPages,
          keywords: [], // Will be fetched from database
          delayMs,
        });
      } else {
        return NextResponse.json({
          error: 'Unsupported portal',
          details: `Portal ${portalUrl} is not supported for Chromium scraping.`,
        }, { status: 400 });
      }

      console.log('[API] Chromium scraping completed:', {
        success: scrapingResult?.success,
        totalScraped: scrapingResult?.totalScraped,
        newItems: scrapingResult?.newItems,
        errors: scrapingResult?.errors?.length || 0
      });

    } catch (executionError: any) {
      // Handle execution errors
      console.error('[API] Chromium scraping execution error:', executionError);
      return NextResponse.json({
        error: 'Chromium scraping execution failed',
        details: executionError.message || 'An error occurred during chromium scraping execution.',
      }, { status: 500 });
    }

    // Validate scraping result before returning
    if (!scrapingResult) {
      console.error('[API] No scraping result returned');
      return NextResponse.json({
        error: 'Scraping completed but no result returned',
        details: 'The scraping function completed but did not return a valid result object.',
      }, { status: 500 });
    }

    // Ensure result has required properties
    const validatedResult = {
      success: scrapingResult.success || false,
      totalScraped: scrapingResult.totalScraped || 0,
      newItems: scrapingResult.newItems || 0,
      duplicates: scrapingResult.duplicates || 0,
      errors: scrapingResult.errors || [],
      scrapedItems: scrapingResult.scrapedItems || [],
    };

    console.log('[API] Returning validated result:', {
      success: validatedResult.success,
      totalScraped: validatedResult.totalScraped,
      newItems: validatedResult.newItems,
      duplicates: validatedResult.duplicates,
      errorCount: validatedResult.errors.length
    });

    const response = NextResponse.json({
      message: 'Scraping executed successfully',
      result: validatedResult,
    });
    
    // Explicitly set Content-Type header
    response.headers.set('Content-Type', 'application/json');
    return response;

  } catch (error: any) {
    console.error('Execute scraping error:', error);
    console.error('Error stack:', error.stack);
    
    // Ensure we always return a valid JSON response
    const errorResponse = {
      error: 'Scraping failed',
      details: error?.message || 'An unexpected error occurred during scraping.',
      timestamp: new Date().toISOString(),
    };
    
    if (error.message?.includes('required')) {
      return NextResponse.json(errorResponse, { status: 403 });
    }
    if (error.message?.includes('scraping')) {
      return NextResponse.json(errorResponse, { status: 400 });
    }
    
    return NextResponse.json(errorResponse, { status: 500 });
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