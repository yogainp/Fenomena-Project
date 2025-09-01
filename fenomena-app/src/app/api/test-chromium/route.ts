import { NextRequest, NextResponse } from 'next/server';
import { scrapeNewsFromPortal } from '@/lib/scraping-service';

// GET /api/test-chromium - Test Chromium scraping for Kalbar Online
export async function GET(request: NextRequest) {
  try {
    console.log('[TEST] Starting Chromium scraping test for Kalbar Online...');
    
    const options = {
      portalUrl: 'https://kalbaronline.com/berita-daerah/',
      maxPages: 2, // This will translate to 1 View More click (2-1)
      delayMs: 2000
    };
    
    console.log('[TEST] Test configuration:', options);
    
    const startTime = Date.now();
    const result = await scrapeNewsFromPortal(options);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('[TEST] Test completed in', duration, 'ms');
    
    return NextResponse.json({
      test: 'Chromium Scraping Test for Kalbar Online',
      configuration: options,
      duration: duration + 'ms',
      result: {
        success: result.success,
        totalScraped: result.totalScraped,
        newItems: result.newItems,
        duplicates: result.duplicates,
        errorsCount: result.errors.length,
        errors: result.errors,
        sampleArticles: result.scrapedItems.slice(0, 3).map(item => ({
          title: item.title.substring(0, 100) + '...',
          date: item.date,
          keywords: item.matchedKeywords,
          link: item.link
        }))
      },
      validation: {
        expectedMinArticles: 15,
        actualArticles: result.totalScraped,
        passesMinimum: result.totalScraped >= 15,
        withinTimeout: duration < 60000,
        overallStatus: result.success && result.totalScraped >= 15 && duration < 60000 ? 'PASS' : 'NEEDS_REVIEW'
      }
    });

  } catch (error: any) {
    console.error('[TEST] Test failed:', error);
    return NextResponse.json({
      test: 'Chromium Scraping Test for Kalbar Online',
      error: 'Test failed',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}