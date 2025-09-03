import puppeteer from 'puppeteer-core';
// Import regular puppeteer for development
const puppeteerFull = process.env.NODE_ENV === 'development' ? require('puppeteer') : null;
import chromium from '@sparticuz/chromium';
// Custom delay function to replace node:timers/promises for Edge Runtime compatibility
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
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

// Helper function to create date consistently in Indonesia timezone
function createIndonesianDate(year?: number, month?: number, day?: number): Date {
  if (year && month !== undefined && day) {
    // Create date for specific year/month/day
    // Use UTC to avoid local timezone interference, then adjust
    const utcDate = new Date(Date.UTC(year, month, day, 7, 0, 0)); // 7 AM UTC = 2 PM Indonesia (UTC+7)
    return utcDate;
  } else {
    // Current date in Indonesia timezone
    const now = new Date();
    const indonesianNow = new Date(now.getTime() + (7 * 60 * 60 * 1000)); // Add UTC+7
    return new Date(Date.UTC(indonesianNow.getFullYear(), indonesianNow.getMonth(), indonesianNow.getDate(), 7, 0, 0));
  }
}

// Helper function to format date for debugging
function formatIndonesianDate(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Enhanced Indonesian date parsing function with timezone fix
function parseIndonesianDate(dateString: string): Date {
  if (!dateString) {
    console.log('[CHROMIUM] No date string provided, using current date');
    return createIndonesianDate();
  }
  
  console.log(`[CHROMIUM] === PARSING DATE: "${dateString}" ===`);
  
  // Clean the date string
  const cleanedDate = dateString
    .replace(/^\s*(Dipublikasikan|Published|Tanggal|Date|Oleh|By|Posted|Diterbitkan|Terbit|Berita)[\s:]+/i, '')
    .replace(/^\s*(pada|on|at|di|dalam)[\s:]+/i, '')
    .replace(/^\s*(,|\-|\||–|—)\s*/g, '')
    .replace(/\s+(WIB|WITA|WIT|GMT|UTC|\+\d{2}:\d{2}).*$/i, '')
    .replace(/\s+pukul\s+\d{1,2}[:.].\d{2}.*$/i, '')
    .replace(/\s+\|\s+\d{1,2}[:.]\d{2}.*$/i, '') // Remove " | HH:MM" pattern specific for Pontianak Post
    .replace(/\s+\d{1,2}[:.].\d{2}([:.].\d{2})?.*$/i, '')
    .replace(/^(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu),?\s*/i, '') // Remove day names
    .trim();
  
  console.log(`[CHROMIUM] Cleaned date: "${cleanedDate}"`);
  
  try {
    // Check if it's already a valid ISO date string (from JSON-LD)
    if (cleanedDate.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      console.log(`[CHROMIUM] Detected ISO format: ${cleanedDate}`);
      const isoDate = new Date(cleanedDate);
      if (!isNaN(isoDate.getTime())) {
        // Force to Indonesia timezone date only (no time component)
        const dateOnly = createIndonesianDate(isoDate.getFullYear(), isoDate.getMonth(), isoDate.getDate());
        console.log(`[CHROMIUM] ✅ Successfully parsed ISO date: ${dateOnly.toISOString()}`);
        return dateOnly;
      }
    }
    
    // FIXED: Reorder patterns for better matching - prioritize Indonesian format
    const patterns = [
      // 1. DD Month YYYY format (e.g., "2 September 2025") - HIGHEST PRIORITY for Indonesian
      /^(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|sep|okt|nov|des)\s+(\d{4})$/i,
      // 2. ISO format: YYYY-MM-DD
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      // 3. DD/MM/YYYY or DD-MM-YYYY (CAUTION: ambiguous pattern)
      /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/,
      // 4. Long format with day name (fallback)
      /\w+,?\s+(\d{1,2})\s+(\w+)\s+(\d{4})/i,
    ];
    
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = cleanedDate.match(pattern);
      
      if (match) {
        console.log(`[CHROMIUM] Matched pattern ${i + 1}: ${pattern}`);
        console.log(`[CHROMIUM] Match groups:`, match.slice(1));
        
        let day: number, month: number, year: number;
        
        if (i === 0) {
          // DD Month YYYY format (Indonesian) - HIGHEST PRIORITY
          day = parseInt(match[1]);
          const monthName = match[2].toLowerCase();
          month = INDONESIAN_MONTHS[monthName];
          year = parseInt(match[3]);
          console.log(`[CHROMIUM] 🇮🇩 Detected DD Month YYYY format: ${day} ${monthName} ${year} (month index: ${month})`);
        } else if (i === 1) {
          // YYYY-MM-DD format
          year = parseInt(match[1]);
          month = parseInt(match[2]) - 1; // Convert to 0-based month
          day = parseInt(match[3]);
          console.log(`[CHROMIUM] Detected YYYY-MM-DD format: ${year}-${month + 1}-${day}`);
        } else if (i === 2) {
          // DD/MM/YYYY format - CAUTION: Could be DD/MM or MM/DD
          // Assume DD/MM for Indonesian context but add validation
          const num1 = parseInt(match[1]);
          const num2 = parseInt(match[2]);
          
          // Validate: if first number > 12, it's definitely day
          // if second number > 12, it's definitely month
          if (num1 > 12) {
            day = num1;
            month = num2 - 1;
          } else if (num2 > 12) {
            day = num2;
            month = num1 - 1;
          } else {
            // Both are <= 12, assume DD/MM format for Indonesian context
            day = num1;
            month = num2 - 1;
            console.log(`[CHROMIUM] ⚠️ Ambiguous DD/MM format, assuming DD/MM: ${day}/${month + 1}`);
          }
          year = parseInt(match[3]);
          console.log(`[CHROMIUM] Detected DD/MM/YYYY format: ${day}/${month + 1}/${year}`);
        } else if (i === 3) {
          // Long format with day name (fallback)
          day = parseInt(match[1]);
          const monthName = match[2].toLowerCase();
          month = INDONESIAN_MONTHS[monthName];
          year = parseInt(match[3]);
          console.log(`[CHROMIUM] Detected Long format: ${day} ${monthName} ${year}`);
        } else {
          continue;
        }
        
        // Validate parsed values
        if (month !== undefined && !isNaN(month) && month >= 0 && month <= 11 &&
            !isNaN(day) && day >= 1 && day <= 31 &&
            !isNaN(year) && year >= 2020 && year <= 2030) {
          
          // FIXED: Create date in Indonesia timezone consistently
          const parsedDate = createIndonesianDate(year, month, day);
          console.log(`[CHROMIUM] ✅ Successfully parsed: ${parsedDate.toISOString()} (Indonesia: ${formatIndonesianDate(parsedDate)})`);
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
  
  // Fallback to current date in Indonesia timezone
  console.log('[CHROMIUM] ⚠️ Using current date as fallback');
  return createIndonesianDate();
}

// Helper function to clean text content
function cleanTextContent(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
}


// Helper function to parse relative date format ("X jam lalu", "X menit lalu") and absolute dates
function parseRelativeDate(relativeText: string): Date {
  const now = new Date();
  const lowerText = relativeText.toLowerCase().trim();
  
  console.log(`[CHROMIUM] Parsing date: "${relativeText}"`);
  
  // Pattern for "X jam lalu" - untuk halaman 1
  const hourMatch = lowerText.match(/(\d+)\s*jam\s*lalu/);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1]);
    const resultDate = new Date(now.getTime() - (hours * 60 * 60 * 1000));
    console.log(`[CHROMIUM] ✅ Parsed "${relativeText}" as ${hours} hours ago: ${resultDate.toISOString()}`);
    return resultDate;
  }
  
  // Pattern for "X menit lalu" - untuk halaman 1 
  const minuteMatch = lowerText.match(/(\d+)\s*menit\s*lalu/);
  if (minuteMatch) {
    const minutes = parseInt(minuteMatch[1]);
    const resultDate = new Date(now.getTime() - (minutes * 60 * 1000));
    console.log(`[CHROMIUM] ✅ Parsed "${relativeText}" as ${minutes} minutes ago: ${resultDate.toISOString()}`);
    return resultDate;
  }
  
  // Pattern for "X hari lalu"
  const dayMatch = lowerText.match(/(\d+)\s*hari\s*lalu/);
  if (dayMatch) {
    const days = parseInt(dayMatch[1]);
    const resultDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    console.log(`[CHROMIUM] ✅ Parsed "${relativeText}" as ${days} days ago: ${resultDate.toISOString()}`);
    return resultDate;
  }
  
  // Check for Indonesian date format: "29 Agustus 2025 22:53" - untuk halaman pagination
  const indonesianDateMatch = relativeText.match(/(\d{1,2})\s+(\w+)\s+(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (indonesianDateMatch) {
    const day = parseInt(indonesianDateMatch[1]);
    const monthName = indonesianDateMatch[2].toLowerCase();
    const year = parseInt(indonesianDateMatch[3]);
    const hour = parseInt(indonesianDateMatch[4]);
    const minute = parseInt(indonesianDateMatch[5]);
    
    const month = INDONESIAN_MONTHS[monthName];
    if (month !== undefined) {
      const resultDate = new Date(year, month, day, hour, minute);
      console.log(`[CHROMIUM] ✅ Parsed Indonesian date format "${relativeText}": ${resultDate.toISOString()}`);
      return resultDate;
    }
  }
  
  // If not relative format or Indonesian format, fallback to regular date parsing
  console.log(`[CHROMIUM] ⚠️ Not a recognized format, using regular parsing for: "${relativeText}"`);
  return parseIndonesianDate(relativeText);
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
        await delay(3000 + Math.random() * 2000); // 3-5 seconds
        
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
          await delay(delayMs);
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

// Interface for Pontianak Post scraping options
interface PontianakPostScrapingOptions {
  portalUrl: string;
  maxPages: number;
  keywords: string[];
  delayMs: number;
}

// Interface for Tribun Pontianak scraping options
interface TribunPontianakScrapingOptions {
  portalUrl: string;
  maxPages: number;
  keywords: string[];
  delayMs: number;
}

// Interface for Kalbar Antaranews scraping options
interface KalbarAntaranewsScrapingOptions {
  portalUrl: string;
  maxPages: number;
  keywords: string[];
  delayMs: number;
}

// Main Chromium scraping function for Pontianak Post
export async function scrapePontianakPostWithChromium(options: PontianakPostScrapingOptions): Promise<ChromiumScrapingResult> {
  const { portalUrl, maxPages, keywords, delayMs } = options;
  
  const result: ChromiumScrapingResult = {
    success: false,
    totalScraped: 0,
    newItems: 0,
    duplicates: 0,
    errors: [],
    scrapedItems: [],
  };

  let browser: any = null;
  
  try {
    console.log(`[CHROMIUM-PP] 🚀 Starting Pontianak Post scraping`);
    console.log(`[CHROMIUM-PP] Target: ${portalUrl}`);
    console.log(`[CHROMIUM-PP] Max Pages: ${maxPages}`);
    console.log(`[CHROMIUM-PP] Delay: ${delayMs}ms`);
    
    // Get active keywords from database if not provided
    const activeKeywords = keywords.length > 0 ? keywords : 
      (await getActiveKeywords()).map(k => (k.keyword as string).toLowerCase());

    if (activeKeywords.length === 0) {
      throw new Error('No active keywords found. Please add keywords first.');
    }

    console.log(`[CHROMIUM-PP] Keywords: ${activeKeywords.length} active`);
    
    // Launch browser with same approach as Kalbar Online
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment && puppeteerFull) {
      // Development mode: Use regular puppeteer
      console.log('[CHROMIUM-PP] 🔧 Development mode: Using local puppeteer');
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
        ignoreHTTPSErrors: true,
        timeout: 30000,
      });
    } else {
      // Production mode: Use @sparticuz/chromium for Vercel
      console.log('[CHROMIUM-PP] 🚀 Production mode: Using @sparticuz/chromium');
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
          '--window-size=1024,768',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--aggressive-cache-discard',
        ],
        defaultViewport: { 
          width: 1024, 
          height: 768
        },
        executablePath: await chromium.executablePath(),
        headless: true,
        ignoreHTTPSErrors: true,
        timeout: 30000,
      });
    }
    
    const page = await browser.newPage();
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Request interception for efficiency
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    // Sets to track processed items
    const processedUrls = new Set<string>();
    const processedTitles = new Set<string>();
    
    // Scrape multiple pages
    for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
      try {
        const pageUrl = currentPage === 1 ? portalUrl : `${portalUrl}?page=${currentPage}`;
        console.log(`[CHROMIUM-PP] 📄 Scraping page ${currentPage}: ${pageUrl}`);
        
        await page.goto(pageUrl, { 
          waitUntil: 'networkidle2', 
          timeout: 30000 
        });
        
        // Wait for content to load
        await delay(2000);
        
        // Extract articles using the correct selector for Pontianak Post
        const articles = await page.evaluate(() => {
          const articleElements = document.querySelectorAll('h2.latest__title');
          const extractedArticles: any[] = [];
          
          for (const element of articleElements) {
            try {
              const linkElement = element.querySelector('a');
              if (!linkElement) continue;
              
              const title = linkElement.textContent?.trim() || '';
              const href = linkElement.getAttribute('href') || '';
              
              if (title.length > 5 && href) {
                const fullLink = href.startsWith('http') ? href : 
                  'https://pontianakpost.jawapos.com' + href;
                
                // Look for date in parent container
                let dateString = '';
                const parentContainer = element.closest('.latest__item');
                if (parentContainer) {
                  const dateElement = parentContainer.querySelector('.latest__date, date');
                  if (dateElement) {
                    dateString = dateElement.textContent?.trim() || '';
                  }
                }
                
                extractedArticles.push({
                  title: title.replace(/\s+/g, ' ').trim(),
                  link: fullLink,
                  dateString: dateString
                });
              }
            } catch (articleError) {
              console.error('Error extracting article:', articleError);
            }
          }
          
          return extractedArticles;
        });
        
        console.log(`[CHROMIUM-PP] 📰 Found ${articles.length} articles on page ${currentPage}`);
        
        if (articles.length === 0) {
          console.log(`[CHROMIUM-PP] ⚠️ No articles found on page ${currentPage}, stopping pagination`);
          break;
        }
        
        // Process articles
        for (const article of articles) {
          try {
            // Check if title matches any keywords
            const titleLower = article.title.toLowerCase();
            const matchedKeywords = activeKeywords.filter(keyword => 
              titleLower.includes(keyword)
            );
            
            if (matchedKeywords.length === 0) {
              continue; // Skip if no keywords match
            }
            
            console.log(`[CHROMIUM-PP] 🔍 Processing: "${article.title.substring(0, 60)}..." (Keywords: ${matchedKeywords.join(', ')})`);
            
            // Check for duplicates
            if (await checkDuplicateArticle(article.title, article.link, processedUrls, processedTitles)) {
              console.log(`[CHROMIUM-PP] ⚠️ Duplicate found, skipping: "${article.title.substring(0, 40)}..."`);
              result.duplicates++;
              continue;
            }
            
            // Try to get article content
            let content = '';
            try {
              const articleResponse = await page.goto(article.link, { timeout: 15000 });
              if (articleResponse?.ok()) {
                content = await page.evaluate(() => {
                  // Common selectors for article content
                  const selectors = [
                    '.content p',
                    '.article-content p', 
                    '.entry-content p',
                    'article p',
                    '.post-content p',
                    'p'
                  ];
                  
                  for (const selector of selectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                      return Array.from(elements)
                        .map(el => el.textContent?.trim())
                        .filter(text => text && text.length > 20)
                        .slice(0, 5) // First 5 paragraphs
                        .join(' ');
                    }
                  }
                  return '';
                });
              }
            } catch (contentError) {
              console.log(`[CHROMIUM-PP] ⚠️ Could not fetch content for: ${article.title.substring(0, 40)}...`);
              content = article.title; // Fallback to title
            }
            
            // Parse date
            let parsedDate: Date;
            try {
              parsedDate = parseIndonesianDate(article.dateString);
            } catch (dateError) {
              console.log(`[CHROMIUM-PP] ⚠️ Could not parse date "${article.dateString}", using current date`);
              parsedDate = new Date();
            }
            
            // Save to database
            try {
              const newsItem: ScrapedNewsItem = {
                title: article.title,
                content: content || article.title,
                link: article.link,
                date: parsedDate,
                portal: portalUrl,
                matchedKeywords,
              };
              
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
              const activeKeywordObjects = await getActiveKeywords();
              for (const keyword of matchedKeywords) {
                const keywordObj = activeKeywordObjects.find(k => 
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
              
              console.log(`[CHROMIUM-PP] ✅ Successfully scraped: "${article.title.substring(0, 50)}..." (Keywords: ${matchedKeywords.join(', ')})`);
              
            } catch (saveError) {
              console.error('[CHROMIUM-PP] ❌ Error saving article:', saveError);
              result.errors.push(`Failed to save article: ${article.title}`);
            }
            
          } catch (articleError) {
            console.error('[CHROMIUM-PP] ❌ Error processing article:', articleError);
            result.errors.push(`Error processing article: ${article.title}`);
          }
        }
        
        result.totalScraped += articles.length;
        
        // Add delay between pages
        if (currentPage < maxPages && delayMs > 0) {
          console.log(`[CHROMIUM-PP] ⏸️ Waiting ${delayMs}ms before next page...`);
          await delay(delayMs);
        }
        
      } catch (pageError) {
        console.error(`[CHROMIUM-PP] ❌ Error scraping page ${currentPage}:`, pageError);
        result.errors.push(`Error scraping page ${currentPage}: ${pageError}`);
        break; // Stop on page errors
      }
    }
    
    result.success = result.errors.length === 0 || result.newItems > 0;
    console.log(`[CHROMIUM-PP] 🎯 Scraping completed. Total: ${result.totalScraped}, New: ${result.newItems}, Duplicates: ${result.duplicates}`);

  } catch (error: unknown) {
    console.error('[CHROMIUM-PP] ❌ Scraping error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown scraping error';
    result.errors.push(errorMessage);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return result;
}

// Main Chromium scraping function for Tribun Pontianak
export async function scrapeTribunPontianakWithChromium(options: TribunPontianakScrapingOptions): Promise<ChromiumScrapingResult> {
  const { portalUrl, maxPages, keywords, delayMs } = options;
  
  const result: ChromiumScrapingResult = {
    success: false,
    totalScraped: 0,
    newItems: 0,
    duplicates: 0,
    errors: [],
    scrapedItems: [],
  };

  let browser: any = null;
  
  try {
    console.log(`[CHROMIUM-TP] 🚀 Starting Tribun Pontianak scraping`);
    console.log(`[CHROMIUM-TP] Target: ${portalUrl}`);
    console.log(`[CHROMIUM-TP] Max Pages: ${maxPages}`);
    console.log(`[CHROMIUM-TP] Delay: ${delayMs}ms`);
    
    // Get active keywords from database if not provided
    const activeKeywords = keywords.length > 0 ? keywords : 
      (await getActiveKeywords()).map(k => (k.keyword as string).toLowerCase());

    if (activeKeywords.length === 0) {
      throw new Error('No active keywords found. Please add keywords first.');
    }

    console.log(`[CHROMIUM-TP] Keywords: ${activeKeywords.length} active`);
    
    // Launch browser with same approach as other portals
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment && puppeteerFull) {
      // Development mode: Use regular puppeteer
      console.log('[CHROMIUM-TP] 🔧 Development mode: Using local puppeteer');
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
        ignoreHTTPSErrors: true,
        timeout: 30000,
      });
    } else {
      // Production mode: Use @sparticuz/chromium for Vercel
      console.log('[CHROMIUM-TP] 🚀 Production mode: Using @sparticuz/chromium');
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
          '--window-size=1024,768',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--aggressive-cache-discard',
        ],
        defaultViewport: { 
          width: 1024, 
          height: 768
        },
        executablePath: await chromium.executablePath(),
        headless: true,
        ignoreHTTPSErrors: true,
        timeout: 30000,
      });
    }
    
    const page = await browser.newPage();
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Request interception for efficiency
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    // Sets to track processed items
    const processedUrls = new Set<string>();
    const processedTitles = new Set<string>();
    
    // Scrape multiple pages
    for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
      try {
        const pageUrl = currentPage === 1 ? portalUrl : `${portalUrl}?page=${currentPage}`;
        console.log(`[CHROMIUM-TP] 📄 Scraping page ${currentPage}: ${pageUrl}`);
        
        await page.goto(pageUrl, { 
          waitUntil: 'networkidle2', 
          timeout: 30000 
        });
        
        // Wait for content to load
        await delay(2000);
        
        // Extract articles using the specific selectors for Tribun Pontianak
        const articles = await page.evaluate(() => {
          // Look for article containers using various selectors
          const articleSelectors = [
            'body > div.main > div.content > div.fl.w677 > div > div:nth-child(2) > div.pt10.pb10 > ul > li',
            '.pt10.pb10 ul li',
            'ul li h3',
            'li'
          ];
          
          let articleElements: Element[] = [];
          
          // Try different selectors to find articles
          for (const selector of articleSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              articleElements = Array.from(elements);
              break;
            }
          }
          
          const extractedArticles: any[] = [];
          
          for (const element of articleElements) {
            try {
              // Extract title using the specific selector or alternatives
              let titleElement = element.querySelector('h3');
              if (!titleElement) {
                titleElement = element.querySelector('h2, h4, a[href*="pontianak.tribunnews.com"]');
              }
              
              if (!titleElement) continue;
              
              let linkElement = titleElement.querySelector('a') || titleElement;
              if (linkElement.tagName !== 'A') {
                linkElement = element.querySelector('a[href*="pontianak.tribunnews.com"]');
              }
              
              if (!linkElement) continue;
              
              const title = titleElement.textContent?.trim() || '';
              const href = linkElement.getAttribute('href') || '';
              
              if (title.length > 5 && href) {
                const fullLink = href.startsWith('http') ? href : 
                  'https://pontianak.tribunnews.com' + href;
                
                // Extract date using the specific selector or alternatives
                let dateString = '';
                const dateElement = element.querySelector('time') || 
                                   element.querySelector('.date, .tanggal, [class*="date"], [class*="time"]');
                if (dateElement) {
                  dateString = dateElement.getAttribute('datetime') || 
                               dateElement.textContent?.trim() || '';
                }
                
                // Fallback: look for date pattern in element text
                if (!dateString) {
                  const elementText = element.textContent || '';
                  const dateMatch = elementText.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}-\d{1,2}-\d{4}|\d{1,2}\s+\w+\s+\d{4})/);
                  if (dateMatch) {
                    dateString = dateMatch[1];
                  }
                }
                
                extractedArticles.push({
                  title: title.replace(/\s+/g, ' ').trim(),
                  link: fullLink,
                  dateString: dateString
                });
              }
            } catch (articleError) {
              console.error('Error extracting article:', articleError);
            }
          }
          
          return extractedArticles;
        });
        
        console.log(`[CHROMIUM-TP] 📰 Found ${articles.length} articles on page ${currentPage}`);
        
        if (articles.length === 0) {
          console.log(`[CHROMIUM-TP] ⚠️ No articles found on page ${currentPage}, stopping pagination`);
          break;
        }
        
        // Process articles
        for (const article of articles) {
          try {
            // Check if title matches any keywords
            const titleLower = article.title.toLowerCase();
            const matchedKeywords = activeKeywords.filter(keyword => 
              titleLower.includes(keyword)
            );
            
            if (matchedKeywords.length === 0) {
              continue; // Skip if no keywords match
            }
            
            console.log(`[CHROMIUM-TP] 🔍 Processing: "${article.title.substring(0, 60)}..." (Keywords: ${matchedKeywords.join(', ')})`);
            
            // Check for duplicates
            if (await checkDuplicateArticle(article.title, article.link, processedUrls, processedTitles)) {
              console.log(`[CHROMIUM-TP] ⚠️ Duplicate found, skipping: "${article.title.substring(0, 40)}..."`);
              result.duplicates++;
              continue;
            }
            
            // Try to get article content
            let content = '';
            try {
              const articleResponse = await page.goto(article.link, { timeout: 15000 });
              if (articleResponse?.ok()) {
                content = await page.evaluate(() => {
                  // Common selectors for article content in Tribun sites
                  const selectors = [
                    '.txt-article p',
                    '.artikel p',
                    '.content p',
                    '.article-content p', 
                    '.entry-content p',
                    'article p',
                    '.post-content p',
                    'p'
                  ];
                  
                  for (const selector of selectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                      return Array.from(elements)
                        .map(el => el.textContent?.trim())
                        .filter(text => text && text.length > 20)
                        .slice(0, 5) // First 5 paragraphs
                        .join(' ');
                    }
                  }
                  return '';
                });
              }
            } catch (contentError) {
              console.log(`[CHROMIUM-TP] ⚠️ Could not fetch content for: ${article.title.substring(0, 40)}...`);
              content = article.title; // Fallback to title
            }
            
            // Parse date
            let parsedDate: Date;
            try {
              parsedDate = parseIndonesianDate(article.dateString);
            } catch (dateError) {
              console.log(`[CHROMIUM-TP] ⚠️ Could not parse date "${article.dateString}", using current date`);
              parsedDate = new Date();
            }
            
            // Save to database
            try {
              const newsItem: ScrapedNewsItem = {
                title: article.title,
                content: content || article.title,
                link: article.link,
                date: parsedDate,
                portal: portalUrl,
                matchedKeywords,
              };
              
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
              const activeKeywordObjects = await getActiveKeywords();
              for (const keyword of matchedKeywords) {
                const keywordObj = activeKeywordObjects.find(k => 
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
              
              console.log(`[CHROMIUM-TP] ✅ Successfully scraped: "${article.title.substring(0, 50)}..." (Keywords: ${matchedKeywords.join(', ')})`);
              
            } catch (saveError) {
              console.error('[CHROMIUM-TP] ❌ Error saving article:', saveError);
              result.errors.push(`Failed to save article: ${article.title}`);
            }
            
          } catch (articleError) {
            console.error('[CHROMIUM-TP] ❌ Error processing article:', articleError);
            result.errors.push(`Error processing article: ${article.title}`);
          }
        }
        
        result.totalScraped += articles.length;
        
        // Check for pagination and handle next page
        try {
          const hasNextPage = await page.evaluate(() => {
            // Look for pagination using the specific selector or alternatives
            const paginationSelectors = [
              '#paginga > div.paging',
              '.paging',
              '.pagination',
              '[class*="paging"]',
              '[class*="pagination"]'
            ];
            
            for (const selector of paginationSelectors) {
              const pagingElement = document.querySelector(selector);
              if (pagingElement) {
                // Look for next page link
                const nextLink = pagingElement.querySelector('a[href*="page"]') ||
                                pagingElement.querySelector('a:last-child') ||
                                pagingElement.querySelector('.next, .selanjutnya');
                return !!nextLink;
              }
            }
            return false;
          });
          
          if (!hasNextPage && currentPage >= maxPages) {
            console.log(`[CHROMIUM-TP] 📄 No more pages available after page ${currentPage}`);
            break;
          }
          
        } catch (paginationError) {
          console.log(`[CHROMIUM-TP] ⚠️ Could not check pagination, continuing...`);
        }
        
        // Add delay between pages
        if (currentPage < maxPages && delayMs > 0) {
          console.log(`[CHROMIUM-TP] ⏸️ Waiting ${delayMs}ms before next page...`);
          await delay(delayMs);
        }
        
      } catch (pageError) {
        console.error(`[CHROMIUM-TP] ❌ Error scraping page ${currentPage}:`, pageError);
        result.errors.push(`Error scraping page ${currentPage}: ${pageError}`);
        break; // Stop on page errors
      }
    }
    
    result.success = result.errors.length === 0 || result.newItems > 0;
    console.log(`[CHROMIUM-TP] 🎯 Scraping completed. Total: ${result.totalScraped}, New: ${result.newItems}, Duplicates: ${result.duplicates}`);

  } catch (error: unknown) {
    console.error('[CHROMIUM-TP] ❌ Scraping error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown scraping error';
    result.errors.push(errorMessage);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return result;
}

// Main Chromium scraping function for Kalbar Antaranews
export async function scrapeKalbarAntaranewsWithChromium(options: KalbarAntaranewsScrapingOptions): Promise<ChromiumScrapingResult> {
  const { portalUrl, maxPages, keywords, delayMs } = options;
  
  const result: ChromiumScrapingResult = {
    success: false,
    totalScraped: 0,
    newItems: 0,
    duplicates: 0,
    errors: [],
    scrapedItems: [],
  };

  let browser: any = null;
  
  try {
    console.log(`[CHROMIUM-KA] 🚀 Starting Kalbar Antaranews scraping`);
    console.log(`[CHROMIUM-KA] Target: ${portalUrl}`);
    console.log(`[CHROMIUM-KA] Max Pages: ${maxPages}`);
    console.log(`[CHROMIUM-KA] Delay: ${delayMs}ms`);
    
    // Get active keywords from database if not provided
    const activeKeywords = keywords.length > 0 ? keywords : 
      (await getActiveKeywords()).map(k => (k.keyword as string).toLowerCase());

    if (activeKeywords.length === 0) {
      throw new Error('No active keywords found. Please add keywords first.');
    }

    console.log(`[CHROMIUM-KA] Keywords: ${activeKeywords.length} active`);
    
    // Launch browser with same approach as other portals
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment && puppeteerFull) {
      // Development mode: Use regular puppeteer
      console.log('[CHROMIUM-KA] 🔧 Development mode: Using local puppeteer');
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
        ignoreHTTPSErrors: true,
        timeout: 30000,
      });
    } else {
      // Production mode: Use @sparticuz/chromium for Vercel
      console.log('[CHROMIUM-KA] 🚀 Production mode: Using @sparticuz/chromium');
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
          '--window-size=1024,768',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--aggressive-cache-discard',
        ],
        defaultViewport: { 
          width: 1024, 
          height: 768
        },
        executablePath: await chromium.executablePath(),
        headless: true,
        ignoreHTTPSErrors: true,
        timeout: 30000,
      });
    }
    
    const page = await browser.newPage();
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Request interception for efficiency
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    // Sets to track processed items
    const processedUrls = new Set<string>();
    const processedTitles = new Set<string>();
    
    // Scrape multiple pages
    for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
      try {
        const pageUrl = currentPage === 1 ? portalUrl : `${portalUrl}?page=${currentPage}`;
        console.log(`[CHROMIUM-KA] 📄 Scraping page ${currentPage}: ${pageUrl}`);
        
        await page.goto(pageUrl, { 
          waitUntil: 'networkidle2', 
          timeout: 30000 
        });
        
        // Wait for content to load
        await delay(2000);
        
        // Extract articles using the correct XPath structure for Kalbar Antaranews
        const articles = await page.evaluate(() => {
          // XPath: //*[@id="main-container"]/div[2]/div/div[1]/article[N]
          const articleElements = document.querySelectorAll('#main-container > div:nth-child(2) > div > div:nth-child(1) > article');
          const extractedArticles: any[] = [];
          
          console.log(`[CHROMIUM-KA] Found ${articleElements.length} article elements`);
          
          for (let i = 0; i < articleElements.length; i++) {
            const article = articleElements[i];
            try {
              // Extract title using XPath: article[N]/header/h3/a
              const titleElement = article.querySelector('header h3 a');
              if (!titleElement) {
                console.log(`[CHROMIUM-KA] Article ${i+1}: No title element found`);
                continue;
              }
              
              const title = titleElement.textContent?.trim() || '';
              let href = titleElement.getAttribute('href') || '';
              
              // Extract date using XPath: article[N]/header/p/span/text()
              let dateString = '';
              const dateElement = article.querySelector('header > p > span');
              if (dateElement) {
                dateString = dateElement.textContent?.trim() || '';
                console.log(`[CHROMIUM-KA] Article ${i+1}: Found date: "${dateString}"`);
              } else {
                console.log(`[CHROMIUM-KA] Article ${i+1}: No date element found`);
              }
              
              if (title.length > 5 && href) {
                // Fix URL formation - href already contains full URL based on debug script
                const fullLink = href.startsWith('http') ? href : 
                  `https://kalbar.antaranews.com${href}`;
                
                extractedArticles.push({
                  title: title.replace(/\s+/g, ' ').trim(),
                  link: fullLink,
                  dateString: dateString || '',
                  articleIndex: i + 1
                });
                
                console.log(`[CHROMIUM-KA] Article ${i+1}: "${title.substring(0, 50)}..." | Date: "${dateString}" | Link: ${fullLink}`);
              }
            } catch (articleError) {
              console.error(`[CHROMIUM-KA] Error extracting article ${i+1}:`, articleError);
            }
          }
          
          return extractedArticles;
        });
        
        console.log(`[CHROMIUM-KA] 📰 Found ${articles.length} articles on page ${currentPage}`);
        
        if (articles.length === 0) {
          console.log(`[CHROMIUM-KA] ⚠️ No articles found on page ${currentPage}, stopping pagination`);
          break;
        }
        
        // Process articles
        for (const article of articles) {
          try {
            // Check if title matches any keywords
            const titleLower = article.title.toLowerCase();
            const matchedKeywords = activeKeywords.filter(keyword => 
              titleLower.includes(keyword)
            );
            
            if (matchedKeywords.length === 0) {
              continue; // Skip if no keywords match
            }
            
            console.log(`[CHROMIUM-KA] 🔍 Processing: "${article.title.substring(0, 60)}..." (Keywords: ${matchedKeywords.join(', ')})`);
            
            // Check for duplicates
            if (await checkDuplicateArticle(article.title, article.link, processedUrls, processedTitles)) {
              console.log(`[CHROMIUM-KA] ⚠️ Duplicate found, skipping: "${article.title.substring(0, 40)}..."`);
              result.duplicates++;
              continue;
            }
            
            // Parse date using parseRelativeDate function which handles both formats
            let parsedDate: Date;
            try {
              if (article.dateString) {
                // parseRelativeDate handles both "X jam lalu" and "1 September 2025 16:24" formats
                parsedDate = parseRelativeDate(article.dateString);
              } else {
                console.log(`[CHROMIUM-KA] ⚠️ No date string found, using current date`);
                parsedDate = new Date();
              }
            } catch (dateError) {
              console.log(`[CHROMIUM-KA] ⚠️ Could not parse date "${article.dateString}", using current date`);
              parsedDate = new Date();
            }
            
            // Try to get article content
            let content = '';
            try {
              const articleResponse = await page.goto(article.link, { timeout: 15000 });
              if (articleResponse?.ok()) {
                content = await page.evaluate(() => {
                  // Common selectors for article content in Kalbar Antaranews
                  const selectors = [
                    '#print_content .artikel',
                    '#print_content',
                    '.article-content',
                    '.entry-content',
                    '.post-content',
                    'article',
                    '.content'
                  ];
                  
                  for (const selector of selectors) {
                    const contentElement = document.querySelector(selector);
                    if (contentElement) {
                      const paragraphs = contentElement.querySelectorAll('p');
                      if (paragraphs.length > 0) {
                        return Array.from(paragraphs)
                          .map(p => p.textContent?.trim())
                          .filter(text => text && text.length > 20)
                          .slice(0, 10) // First 10 paragraphs
                          .join(' ');
                      }
                      
                      // Fallback to element text
                      const text = contentElement.textContent?.trim();
                      if (text && text.length > 100) {
                        return text;
                      }
                    }
                  }
                  
                  // Last resort: get all paragraphs from body
                  const allParagraphs = document.querySelectorAll('p');
                  return Array.from(allParagraphs)
                    .map(p => p.textContent?.trim())
                    .filter(text => text && text.length > 20)
                    .slice(0, 5)
                    .join(' ');
                });
              }
            } catch (contentError) {
              console.log(`[CHROMIUM-KA] ⚠️ Could not fetch content for: ${article.title.substring(0, 40)}...`);
              content = article.title; // Fallback to title
            }
            
            // Save to database
            try {
              const newsItem: ScrapedNewsItem = {
                title: article.title,
                content: content || article.title,
                link: article.link,
                date: parsedDate,
                portal: portalUrl,
                matchedKeywords,
              };
              
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
              const activeKeywordObjects = await getActiveKeywords();
              for (const keyword of matchedKeywords) {
                const keywordObj = activeKeywordObjects.find(k => 
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
              
              console.log(`[CHROMIUM-KA] ✅ Successfully scraped: "${article.title.substring(0, 50)}..." (Keywords: ${matchedKeywords.join(', ')})`);
              
            } catch (saveError) {
              console.error('[CHROMIUM-KA] ❌ Error saving article:', saveError);
              result.errors.push(`Failed to save article: ${article.title}`);
            }
            
          } catch (articleError) {
            console.error('[CHROMIUM-KA] ❌ Error processing article:', articleError);
            result.errors.push(`Error processing article: ${article.title}`);
          }
        }
        
        result.totalScraped += articles.length;
        
        // Check pagination using XPath: //*[@id="main-container"]/div[2]/div/div[1]/div[2]/nav/ul/li[3]/a
        try {
          const hasNextPage = await page.evaluate(() => {
            // Look for pagination navigation
            const paginationSelector = '#main-container > div:nth-child(2) > div > div:nth-child(1) > div:nth-child(2) > nav > ul';
            const paginationList = document.querySelector(paginationSelector);
            if (paginationList) {
              // Look for next page link (usually the last link that's not disabled)
              const nextLinks = paginationList.querySelectorAll('li > a[href*="page"]');
              return nextLinks.length > 0; // If there are page links, assume there might be more pages
            }
            return false;
          });
          
          if (!hasNextPage && currentPage >= maxPages) {
            console.log(`[CHROMIUM-KA] 📄 No more pages available after page ${currentPage}`);
            break;
          }
          
        } catch (paginationError) {
          console.log(`[CHROMIUM-KA] ⚠️ Could not check pagination, continuing...`);
        }
        
        // Add delay between pages
        if (currentPage < maxPages && delayMs > 0) {
          console.log(`[CHROMIUM-KA] ⏸️ Waiting ${delayMs}ms before next page...`);
          await delay(delayMs);
        }
        
      } catch (pageError) {
        console.error(`[CHROMIUM-KA] ❌ Error scraping page ${currentPage}:`, pageError);
        result.errors.push(`Error scraping page ${currentPage}: ${pageError}`);
        break; // Stop on page errors
      }
    }
    
    result.success = result.errors.length === 0 || result.newItems > 0;
    console.log(`[CHROMIUM-KA] 🎯 Scraping completed. Total: ${result.totalScraped}, New: ${result.newItems}, Duplicates: ${result.duplicates}`);

  } catch (error: unknown) {
    console.error('[CHROMIUM-KA] ❌ Scraping error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown scraping error';
    result.errors.push(errorMessage);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return result;
}

// Interface for Suara Kalbar scraping options
interface SuaraKalbarScrapingOptions {
  portalUrl: string;
  maxPages: number;
  keywords: string[];
  delayMs: number;
}

// Main Chromium scraping function for Suara Kalbar
export async function scrapeSuaraKalbarWithChromium(options: SuaraKalbarScrapingOptions): Promise<ChromiumScrapingResult> {
  const { portalUrl, maxPages, keywords, delayMs } = options;
  
  const result: ChromiumScrapingResult = {
    success: false,
    totalScraped: 0,
    newItems: 0,
    duplicates: 0,
    errors: [],
    scrapedItems: [],
  };

  let browser: any = null;
  
  try {
    console.log(`[CHROMIUM-SK] 🚀 Starting Suara Kalbar scraping`);
    console.log(`[CHROMIUM-SK] Target: ${portalUrl}`);
    console.log(`[CHROMIUM-SK] Max Pages: ${maxPages}`);
    console.log(`[CHROMIUM-SK] Delay: ${delayMs}ms`);
    
    // Get active keywords from database if not provided
    const activeKeywords = keywords.length > 0 ? keywords : 
      (await getActiveKeywords()).map(k => (k.keyword as string).toLowerCase());

    if (activeKeywords.length === 0) {
      throw new Error('No active keywords found. Please add keywords first.');
    }

    console.log(`[CHROMIUM-SK] Keywords: ${activeKeywords.length} active`);
    
    // Launch browser with same approach as other portals
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment && puppeteerFull) {
      console.log('[CHROMIUM-SK] 🔧 Development mode: Using local puppeteer');
      browser = await puppeteerFull.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-background-timer-throttling',
        ],
        defaultViewport: { width: 1024, height: 768 },
        ignoreHTTPSErrors: true,
        timeout: 30000,
      });
    } else {
      console.log('[CHROMIUM-SK] 🚀 Production mode: Using @sparticuz/chromium');
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
          '--window-size=1024,768',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--aggressive-cache-discard',
        ],
        defaultViewport: { width: 1024, height: 768 },
        executablePath: await chromium.executablePath(),
        headless: true,
        ignoreHTTPSErrors: true,
        timeout: 30000,
      });
    }
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    const processedUrls = new Set<string>();
    const processedTitles = new Set<string>();
    
    // Scrape multiple pages
    for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
      try {
        const pageUrl = currentPage === 1 ? portalUrl : `${portalUrl}/page/${currentPage}`;
        console.log(`[CHROMIUM-SK] 📄 Scraping page ${currentPage}: ${pageUrl}`);
        
        await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await delay(2000);
        
        // Extract articles using Suara Kalbar specific selectors
        const articles = await page.evaluate(() => {
          const articleSelectors = [
            '.ray-main-post-title a',
            '.post-title a',
            'h2 a',
            'h3 a',
            'a[href*=".suarakalbar.co.id"]',
            '.entry-title a'
          ];
          
          let articleElements: Element[] = [];
          
          for (const selector of articleSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              articleElements = Array.from(elements);
              console.log(`[CHROMIUM-SK] Found ${elements.length} articles using selector: ${selector}`);
              break;
            }
          }
          
          const extractedArticles: any[] = [];
          
          for (let i = 0; i < articleElements.length; i++) {
            const element = articleElements[i];
            try {
              let title = '';
              let href = '';
              
              if (element.tagName === 'A') {
                title = element.textContent?.trim() || '';
                href = element.getAttribute('href') || '';
              } else {
                const linkElement = element.querySelector('a');
                if (linkElement) {
                  title = element.textContent?.trim() || '';
                  href = linkElement.getAttribute('href') || '';
                }
              }
              
              if (title.length > 5 && href) {
                const fullLink = href.startsWith('http') ? href : 
                  `https://www.suarakalbar.co.id${href}`;
                
                // Extract date from parent or nearby elements
                let dateString = '';
                const parentElement = element.closest('article, .post, .entry, div');
                if (parentElement) {
                  const dateElement = parentElement.querySelector('time, .date, .post-date, span[class*="date"]');
                  if (dateElement) {
                    dateString = dateElement.getAttribute('datetime') || 
                                dateElement.textContent?.trim() || '';
                  }
                }
                
                // Look for Indonesian date patterns in surrounding text
                if (!dateString && parentElement) {
                  const parentText = parentElement.textContent || '';
                  const dateMatch = parentText.match(/(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|sep|okt|nov|des)\s+(\d{4})/i);
                  if (dateMatch) {
                    dateString = dateMatch[0];
                  }
                }
                
                extractedArticles.push({
                  title: title.replace(/\s+/g, ' ').trim(),
                  link: fullLink,
                  dateString: dateString || '',
                  articleIndex: i + 1
                });
              }
            } catch (articleError) {
              console.error(`[CHROMIUM-SK] Error extracting article ${i+1}:`, articleError);
            }
          }
          
          return extractedArticles;
        });
        
        console.log(`[CHROMIUM-SK] 📰 Found ${articles.length} articles on page ${currentPage}`);
        
        if (articles.length === 0) {
          console.log(`[CHROMIUM-SK] ⚠️ No articles found on page ${currentPage}, stopping pagination`);
          break;
        }
        
        // Process articles
        for (const article of articles) {
          try {
            // Check if title matches any keywords
            const titleLower = article.title.toLowerCase();
            const matchedKeywords = activeKeywords.filter(keyword => 
              titleLower.includes(keyword)
            );
            
            if (matchedKeywords.length === 0) {
              continue;
            }
            
            console.log(`[CHROMIUM-SK] 🔍 Processing: "${article.title.substring(0, 60)}..." (Keywords: ${matchedKeywords.join(', ')})`);
            
            // Check for duplicates
            if (await checkDuplicateArticle(article.title, article.link, processedUrls, processedTitles)) {
              console.log(`[CHROMIUM-SK] ⚠️ Duplicate found, skipping: "${article.title.substring(0, 40)}..."`);
              result.duplicates++;
              continue;
            }
            
            // Parse date
            let parsedDate: Date;
            try {
              parsedDate = article.dateString ? parseIndonesianDate(article.dateString) : new Date();
            } catch (dateError) {
              console.log(`[CHROMIUM-SK] ⚠️ Could not parse date "${article.dateString}", using current date`);
              parsedDate = new Date();
            }
            
            // Try to get article content
            let content = '';
            try {
              const articleResponse = await page.goto(article.link, { timeout: 15000 });
              if (articleResponse?.ok()) {
                content = await page.evaluate(() => {
                  const selectors = [
                    '.entry-content',
                    '.post-content',
                    '.article-content',
                    '.content',
                    'article',
                    '.single-content'
                  ];
                  
                  for (const selector of selectors) {
                    const contentElement = document.querySelector(selector);
                    if (contentElement) {
                      const paragraphs = contentElement.querySelectorAll('p');
                      if (paragraphs.length > 0) {
                        return Array.from(paragraphs)
                          .map(p => p.textContent?.trim())
                          .filter(text => text && text.length > 20)
                          .slice(0, 10)
                          .join(' ');
                      }
                      
                      const text = contentElement.textContent?.trim();
                      if (text && text.length > 100) {
                        return text;
                      }
                    }
                  }
                  
                  const allParagraphs = document.querySelectorAll('p');
                  return Array.from(allParagraphs)
                    .map(p => p.textContent?.trim())
                    .filter(text => text && text.length > 20)
                    .slice(0, 5)
                    .join(' ');
                });
              }
            } catch (contentError) {
              console.log(`[CHROMIUM-SK] ⚠️ Could not fetch content for: ${article.title.substring(0, 40)}...`);
              content = article.title;
            }
            
            // Save to database
            try {
              const newsItem: ScrapedNewsItem = {
                title: article.title,
                content: content || article.title,
                link: article.link,
                date: parsedDate,
                portal: portalUrl,
                matchedKeywords,
              };
              
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
              const activeKeywordObjects = await getActiveKeywords();
              for (const keyword of matchedKeywords) {
                const keywordObj = activeKeywordObjects.find(k => 
                  (k.keyword as string).toLowerCase() === keyword
                );
                if (keywordObj?.id) {
                  await incrementKeywordMatchCount(keywordObj.id as string);
                }
              }
              
              result.scrapedItems.push(newsItem);
              result.newItems++;
              
              processedUrls.add(article.link.toLowerCase());
              processedTitles.add(article.title.toLowerCase().trim());
              
              console.log(`[CHROMIUM-SK] ✅ Successfully scraped: "${article.title.substring(0, 50)}..." (Keywords: ${matchedKeywords.join(', ')})`);
              
            } catch (saveError) {
              console.error('[CHROMIUM-SK] ❌ Error saving article:', saveError);
              result.errors.push(`Failed to save article: ${article.title}`);
            }
            
          } catch (articleError) {
            console.error('[CHROMIUM-SK] ❌ Error processing article:', articleError);
            result.errors.push(`Error processing article: ${article.title}`);
          }
        }
        
        result.totalScraped += articles.length;
        
        // Add delay between pages
        if (currentPage < maxPages && delayMs > 0) {
          console.log(`[CHROMIUM-SK] ⏸️ Waiting ${delayMs}ms before next page...`);
          await delay(delayMs);
        }
        
      } catch (pageError) {
        console.error(`[CHROMIUM-SK] ❌ Error scraping page ${currentPage}:`, pageError);
        result.errors.push(`Error scraping page ${currentPage}: ${pageError}`);
        break;
      }
    }
    
    result.success = result.errors.length === 0 || result.newItems > 0;
    console.log(`[CHROMIUM-SK] 🎯 Scraping completed. Total: ${result.totalScraped}, New: ${result.newItems}, Duplicates: ${result.duplicates}`);

  } catch (error: unknown) {
    console.error('[CHROMIUM-SK] ❌ Scraping error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown scraping error';
    result.errors.push(errorMessage);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return result;
}

