import puppeteer from 'puppeteer-core';
// Import regular puppeteer for development
// @ts-ignore - Dynamic import based on environment
const puppeteerFull = process.env.NODE_ENV === 'development' ? require('puppeteer') : null;
import chromium from '@sparticuz/chromium';
import { saveScrapedArticle, incrementKeywordMatchCount, getActiveKeywords, checkExistingArticle } from './supabase-helpers';

interface ScrapedNewsItem {
  title: string;
  content: string;
  link: string;
  date: Date;
  portal: string;
  matchedKeywords: string[];
}

interface ChromiumScrapingResult {
  success: boolean;
  totalScraped: number;
  newItems: number;
  duplicates: number;
  errors: string[];
  scrapedItems: ScrapedNewsItem[];
}

interface ChromiumScrapingOptions {
  portalUrl: string;
  maxViewMoreClicks: number;
  keywords: string[];
  delayMs: number;
}

// Indonesian month names mapping
const INDONESIAN_MONTHS: { [key: string]: number } = {
  'januari': 0, 'februari': 1, 'maret': 2, 'april': 3, 'mei': 4, 'juni': 5,
  'juli': 6, 'agustus': 7, 'september': 8, 'oktober': 9, 'november': 10, 'desember': 11,
  'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'jun': 5, 'jul': 6,
  'agu': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'des': 11
};

// Enhanced Indonesian date parsing function
function parseIndonesianDate(dateString: string): Date {
  if (!dateString) {
    console.log('[CHROMIUM] No date string provided, using current date');
    return new Date();
  }
  
  console.log(`[CHROMIUM] === PARSING DATE: "${dateString}" ===`);
  
  // Clean the date string
  const cleanedDate = dateString
    .replace(/^\s*(Dipublikasikan|Published|Tanggal|Date|Oleh|By|Posted|Diterbitkan|Terbit|Berita)[\s:]+/i, '')
    .replace(/^\s*(pada|on|at|di|dalam)[\s:]+/i, '')
    .replace(/^\s*(,|\-|\||–|—)\s*/g, '')
    .replace(/\s+(WIB|WITA|WIT|GMT|UTC|\+\d{2}:\d{2}).*$/i, '')
    .replace(/\s+pukul\s+\d{1,2}[:.].\d{2}.*$/i, '')
    .replace(/\s+\d{1,2}[:.].\d{2}([:.].\d{2})?.*$/i, '')
    .trim();
  
  console.log(`[CHROMIUM] Cleaned date: "${cleanedDate}"`);
  
  try {
    // Enhanced patterns including DD/MM/YYYY format
    const patterns = [
      // DD/MM/YYYY or DD-MM-YYYY (most common for Kalbar Online)
      /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/,
      // ISO format: YYYY-MM-DD
      /(\d{4})-(\d{1,2})-(\d{1,2})$/,
      // DD Month YYYY format
      /(\d{1,2})\s+(\w+)\s+(\d{4})/i,
      // Long format with day name
      /\w+,?\s+(\d{1,2})\s+(\w+)\s+(\d{4})/i,
    ];
    
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = cleanedDate.match(pattern);
      
      if (match) {
        console.log(`[CHROMIUM] Matched pattern ${i + 1}: ${pattern}`);
        
        let day: number, month: number, year: number;
        
        if (i === 0) {
          // DD/MM/YYYY format - most common for Kalbar Online
          day = parseInt(match[1]);
          month = parseInt(match[2]) - 1; // Convert to 0-based month
          year = parseInt(match[3]);
          console.log(`[CHROMIUM] Detected DD/MM/YYYY format: ${day}/${month + 1}/${year}`);
        } else if (i === 1) {
          // YYYY-MM-DD format
          year = parseInt(match[1]);
          month = parseInt(match[2]) - 1;
          day = parseInt(match[3]);
        } else if (i === 2 || i === 3) {
          // DD Month YYYY format
          day = parseInt(match[1]);
          const monthName = match[2].toLowerCase();
          month = INDONESIAN_MONTHS[monthName];
          year = parseInt(match[3]);
        } else {
          continue;
        }
        
        // Validate parsed values
        if (month !== undefined && !isNaN(month) && month >= 0 && month <= 11 &&
            !isNaN(day) && day >= 1 && day <= 31 &&
            !isNaN(year) && year >= 2020 && year <= 2030) {
          
          const parsedDate = new Date(year, month, day);
          console.log(`[CHROMIUM] ✅ Successfully parsed: ${parsedDate.toISOString()}`);
          return parsedDate;
        } else {
          console.log(`[CHROMIUM] ❌ Invalid parsed values: day=${day}, month=${month}, year=${year}`);
        }
      }
    }
    
    console.log(`[CHROMIUM] ❌ No pattern matched for: "${cleanedDate}"`);
    
  } catch (error) {
    console.error('[CHROMIUM] Error in date parsing:', error);
  }
  
  // Fallback to current date
  console.log('[CHROMIUM] ⚠️ Using current date as fallback');
  return new Date();
}

// Helper function to clean text content
function cleanTextContent(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
}

// Check for duplicate articles
async function checkDuplicateArticle(
  title: string, 
  url: string, 
  processedUrls: Set<string>, 
  processedTitles: Set<string>
): Promise<boolean> {
  const normalizedTitle = title.toLowerCase().trim();
  const normalizedUrl = url.toLowerCase();
  
  if (processedUrls.has(normalizedUrl) || processedTitles.has(normalizedTitle)) {
    return true;
  }
  
  const exists = await checkExistingArticle(url, title);
  
  if (exists) {
    processedUrls.add(normalizedUrl);
    processedTitles.add(normalizedTitle);
    return true;
  }
  
  return false;
}

// Main Chromium scraping function for Kalbar Online
export async function scrapeKalbarOnlineWithChromium(options: ChromiumScrapingOptions): Promise<ChromiumScrapingResult> {
  const { portalUrl, maxViewMoreClicks, keywords, delayMs } = options;
  
  const result: ChromiumScrapingResult = {
    success: false,
    totalScraped: 0,
    newItems: 0,
    duplicates: 0,
    errors: [],
    scrapedItems: [],
  };

  let browser;
  
  try {
    console.log('[CHROMIUM] Starting Kalbar Online scraping with browser automation...');
    
    // Get active keywords from database if not provided
    let keywordList = keywords;
    if (!keywordList || keywordList.length === 0) {
      const activeKeywords = await getActiveKeywords();
      keywordList = activeKeywords.map(k => (k.keyword as string).toLowerCase());
    }
    
    if (keywordList.length === 0) {
      throw new Error('No active keywords found');
    }
    
    console.log(`[CHROMIUM] Using ${keywordList.length} keywords: ${keywordList.join(', ')}`);
    
    // Launch browser with environment-specific settings
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment && puppeteerFull) {
      // Development mode: Use regular puppeteer
      console.log('[CHROMIUM] 🔧 Development mode: Using local puppeteer');
      browser = await puppeteerFull.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-background-timer-throttling',
        ],
        defaultViewport: { 
          width: 1024, 
          height: 768 
        },
        timeout: 30000,
      });
    } else {
      // Production mode: Use @sparticuz/chromium for Vercel
      console.log('[CHROMIUM] 🚀 Production mode: Using @sparticuz/chromium');
      browser = await puppeteer.launch({
        args: [
          ...chromium.args,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-acceleration',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--memory-pressure-off',
          // Vercel Free Plan optimizations
          '--max-old-space-size=512', // Limit memory usage to 512MB
          '--disable-extensions',
          '--disable-plugins',
          '--disable-images',
          // Note: JavaScript is required for View More button functionality
          '--disable-web-security',
          '--aggressive-cache-discard',
        ],
        defaultViewport: { 
          width: 1024, 
          height: 768 // Smaller viewport to save memory
        },
        executablePath: await chromium.executablePath(),
        headless: true, // Always headless for serverless
        ignoreHTTPSErrors: true,
        timeout: 30000, // 30 second timeout for browser launch
      });
    }
    
    const page = await browser.newPage();
    
    // Vercel Free Plan: 10 second timeout limit protection
    const startTime = Date.now();
    const VERCEL_FREE_TIMEOUT = 8000; // 8 seconds to leave buffer
    
    // Set user agent and headers
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Disable images and CSS to save bandwidth and memory
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    // Navigate to Kalbar Online berita-daerah page
    const targetUrl = portalUrl.includes('berita-daerah') ? portalUrl : 'https://kalbaronline.com/berita-daerah/';
    console.log(`[CHROMIUM] Navigating to: ${targetUrl}`);
    
    await page.goto(targetUrl, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Sets to track processed items
    const processedUrls = new Set<string>();
    const processedTitles = new Set<string>();
    
    // Initial scraping of articles
    await scrapeCurrentArticles(page, keywordList, result, processedUrls, processedTitles, targetUrl);
    
    // Click "View More" button multiple times to load more articles
    for (let clickCount = 0; clickCount < maxViewMoreClicks; clickCount++) {
      try {
        // Check timeout for Vercel Free Plan
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime > VERCEL_FREE_TIMEOUT) {
          console.log(`[CHROMIUM] ⏰ Timeout approaching (${elapsedTime}ms), stopping to avoid Vercel limit`);
          break;
        }
        
        console.log(`[CHROMIUM] Attempting View More click ${clickCount + 1}/${maxViewMoreClicks} (elapsed: ${elapsedTime}ms)`);
        
        // Wait for the View More button and click it
        const viewMoreButton = await page.$('#main > div.text-center.gmr-newinfinite > p > button, .view-more-button, button[class*="more"], button[class*="load"]');
        
        if (!viewMoreButton) {
          console.log('[CHROMIUM] View More button not found, stopping...');
          break;
        }
        
        // Check if button is visible and enabled
        const isVisible = await page.evaluate(button => {
          return button.offsetWidth > 0 && button.offsetHeight > 0 && !button.disabled;
        }, viewMoreButton);
        
        if (!isVisible) {
          console.log('[CHROMIUM] View More button not visible or disabled, stopping...');
          break;
        }
        
        // Click the button
        await viewMoreButton.click();
        console.log(`[CHROMIUM] ✅ View More button clicked ${clickCount + 1}`);
        
        // Wait for new content to load
        await page.waitForTimeout(3000 + Math.random() * 2000); // 3-5 seconds
        
        // Wait for new articles to be loaded
        await page.waitForFunction(
          (expectedCount) => {
            const articles = document.querySelectorAll('.item-article');
            return articles.length >= expectedCount;
          },
          { timeout: 10000 },
          (clickCount + 2) * 15 // Expect at least (initial + clicks) * 15 articles
        );
        
        // Scrape newly loaded articles
        await scrapeCurrentArticles(page, keywordList, result, processedUrls, processedTitles, targetUrl);
        
        // Add delay between clicks
        if (delayMs > 0 && clickCount < maxViewMoreClicks - 1) {
          await page.waitForTimeout(delayMs);
        }
        
      } catch (clickError) {
        console.error(`[CHROMIUM] Error during View More click ${clickCount + 1}:`, clickError);
        // Don't break, try to continue with existing articles
        break;
      }
    }
    
    result.success = true;
    console.log(`[CHROMIUM] ✅ Scraping completed. Total: ${result.totalScraped}, New: ${result.newItems}, Duplicates: ${result.duplicates}`);
    
  } catch (error) {
    console.error('[CHROMIUM] Scraping failed:', error);
    result.errors.push(`Chromium scraping failed: ${error}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  
  return result;
}

// Helper function to scrape current articles on page
async function scrapeCurrentArticles(
  page: any,
  keywords: string[],
  result: ChromiumScrapingResult,
  processedUrls: Set<string>,
  processedTitles: Set<string>,
  portalUrl: string
): Promise<void> {
  try {
    // Extract articles using the correct selector
    const articles = await page.evaluate(() => {
      const articleElements = document.querySelectorAll('.item-article');
      const extractedArticles = [];
      
      for (const article of articleElements) {
        try {
          // Extract title and link
          const titleElement = article.querySelector('h2 a, h3 a, .entry-title a, a[href*="/"]');
          if (!titleElement) continue;
          
          const title = titleElement.textContent?.trim() || '';
          const link = titleElement.getAttribute('href') || '';
          
          if (!title || !link || title.length < 10) continue;
          
          // Extract date using the specific selector
          let dateString = '';
          const dateElement = article.querySelector('time.entry-date.published, .entry-meta time, .posted-on time');
          if (dateElement) {
            dateString = dateElement.getAttribute('datetime') || dateElement.textContent?.trim() || '';
          }
          
          // Fallback date extraction
          if (!dateString) {
            const metaElement = article.querySelector('.entry-meta, .post-date, time, span[class*="date"]');
            if (metaElement) {
              dateString = metaElement.textContent?.trim() || '';
            }
          }
          
          // Last fallback - look for DD/MM/YYYY pattern in article text
          if (!dateString) {
            const articleText = article.textContent || '';
            const dateMatch = articleText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
            if (dateMatch) {
              dateString = dateMatch[1];
            }
          }
          
          extractedArticles.push({
            title: title.replace(/\s+/g, ' ').trim(),
            link: link.startsWith('http') ? link : new URL(link, 'https://kalbaronline.com').href,
            dateString: dateString
          });
          
        } catch (articleError) {
          console.error('Error extracting article:', articleError);
        }
      }
      
      return extractedArticles;
    });
    
    console.log(`[CHROMIUM] Found ${articles.length} articles on current page state`);
    
    // Filter articles by keywords and process them
    for (const article of articles) {
      try {
        // Check if title matches any keywords
        const titleLower = article.title.toLowerCase();
        const matchedKeywords = keywords.filter(keyword => titleLower.includes(keyword));
        
        if (matchedKeywords.length === 0) {
          continue; // Skip if no keywords match
        }
        
        console.log(`[CHROMIUM] 🔍 Processing: "${article.title.substring(0, 60)}..." (Keywords: ${matchedKeywords.join(', ')})`);
        
        // Check for duplicates
        if (await checkDuplicateArticle(article.title, article.link, processedUrls, processedTitles)) {
          console.log(`[CHROMIUM] ⚠️ Duplicate found, skipping: "${article.title.substring(0, 40)}..."`);
          result.duplicates++;
          continue;
        }
        
        // Parse date
        const parsedDate = parseIndonesianDate(article.dateString);
        
        // Fetch article content
        let content = '';
        try {
          const articlePage = await page.browser().newPage();
          await articlePage.goto(article.link, { waitUntil: 'networkidle0', timeout: 15000 });
          
          content = await articlePage.evaluate(() => {
            const contentSelectors = ['.entry-content', '.post-content', '.article-content', '.content', 'main'];
            
            for (const selector of contentSelectors) {
              const contentElement = document.querySelector(selector);
              if (contentElement && contentElement.textContent) {
                const text = contentElement.textContent.replace(/\s+/g, ' ').trim();
                if (text.length > 100) {
                  return text;
                }
              }
            }
            
            // Fallback to paragraph content
            const paragraphs = Array.from(document.querySelectorAll('p'))
              .map(p => p.textContent?.trim())
              .filter(text => text && text.length > 20)
              .join(' ');
            
            return paragraphs || '';
          });
          
          await articlePage.close();
          
        } catch (contentError) {
          console.warn(`[CHROMIUM] ❌ Failed to fetch content for ${article.link}:`, contentError);
          content = article.title; // Use title as fallback
        }
        
        // Create news item
        const newsItem: ScrapedNewsItem = {
          title: article.title,
          content: content || article.title,
          link: article.link,
          date: parsedDate,
          portal: portalUrl,
          matchedKeywords,
        };
        
        // Save to database
        try {
          await saveScrapedArticle({
            idBerita: crypto.randomUUID(),
            portalBerita: portalUrl,
            linkBerita: article.link,
            judul: article.title,
            isi: content || article.title,
            tanggalBerita: parsedDate,
            matchedKeywords,
          });
          
          // Update keyword match counts
          const activeKeywords = await getActiveKeywords();
          for (const keyword of matchedKeywords) {
            const keywordObj = activeKeywords.find(k => 
              (k.keyword as string).toLowerCase() === keyword
            );
            if (keywordObj?.id) {
              await incrementKeywordMatchCount(keywordObj.id as string);
            }
          }
          
          result.scrapedItems.push(newsItem);
          result.newItems++;
          
          // Add to processed sets
          processedUrls.add(article.link.toLowerCase());
          processedTitles.add(article.title.toLowerCase().trim());
          
          console.log(`[CHROMIUM] ✅ Successfully scraped: "${article.title.substring(0, 50)}..." (Keywords: ${matchedKeywords.join(', ')})`);
          
        } catch (saveError) {
          console.error('[CHROMIUM] ❌ Error saving article:', saveError);
          result.errors.push(`Failed to save article: ${article.title}`);
        }
        
      } catch (articleError) {
        console.error('[CHROMIUM] ❌ Error processing article:', articleError);
        result.errors.push(`Error processing article: ${article.title}`);
      }
    }
    
    result.totalScraped = articles.length;
    
  } catch (error) {
    console.error('[CHROMIUM] Error scraping current articles:', error);
    result.errors.push(`Error scraping articles: ${error}`);
  }
}