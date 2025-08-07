import { chromium, Browser, Page } from 'playwright';
import { supabase } from './supabase';
import { saveScrapedArticle, incrementKeywordMatchCount, getActiveKeywords, checkExistingArticle } from './supabase-helpers';

interface ScrapingOptions {
  portalUrl: string;
  maxPages: number;
  delayMs: number;
}

interface ScrapedNewsItem {
  title: string;
  content: string;
  link: string;
  date: Date;
  portal: string;
  matchedKeywords: string[];
}

interface ScrapingResult {
  success: boolean;
  totalScraped: number;
  newItems: number;
  duplicates: number;
  errors: string[];
  scrapedItems: ScrapedNewsItem[];
}

// Helper function to check for duplicate articles
async function checkDuplicateArticle(
  title: string, 
  url: string, 
  processedUrls: Set<string>, 
  processedTitles: Set<string>
): Promise<boolean> {
  // Normalize data for comparison
  const normalizedTitle = title.toLowerCase().trim();
  const normalizedUrl = url.toLowerCase();
  
  // Check in-memory sets first (fastest)
  if (processedUrls.has(normalizedUrl) || processedTitles.has(normalizedTitle)) {
    return true;
  }
  
  // Check database for existing articles
  const exists = await checkExistingArticle(url, title);
  
  if (exists) {
    // Add to processed sets to avoid future database queries
    processedUrls.add(normalizedUrl);
    processedTitles.add(normalizedTitle);
    return true;
  }
  
  return false;
}

export async function scrapeNewsFromPortal(options: ScrapingOptions): Promise<ScrapingResult> {
  const { portalUrl, maxPages, delayMs } = options;
  
  let browser: Browser | null = null;
  const result: ScrapingResult = {
    success: false,
    totalScraped: 0,
    newItems: 0,
    duplicates: 0,
    errors: [],
    scrapedItems: [],
  };

  try {
    // Get active keywords from database
    const activeKeywords = await getActiveKeywords();

    if (activeKeywords.length === 0) {
      throw new Error('No active keywords found. Please add keywords first.');
    }

    const keywordList = activeKeywords.map(k => k.keyword.toLowerCase());
    console.log(`Starting scraping with ${keywordList.length} active keywords:`, keywordList);

    // Launch browser
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    // Create context with user agent and additional headers
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none'
      }
    });
    
    const page = await context.newPage();

    // Create tracking sets for duplicate prevention across the entire scraping session
    const processedUrls = new Set<string>();
    const processedTitles = new Set<string>();

    // Scrape based on portal type
    if (portalUrl.includes('pontianakpost.jawapos.com')) {
      await scrapePontianakPost(page, portalUrl, maxPages, delayMs, keywordList, result, processedUrls, processedTitles);
    } else if (portalUrl.includes('kalbaronline.com')) {
      await scrapeKalbarOnline(page, portalUrl, maxPages, delayMs, keywordList, result, processedUrls, processedTitles);
    } else if (portalUrl.includes('kalbar.antaranews.com')) {
      await scrapeAntaraNews(page, portalUrl, maxPages, delayMs, keywordList, result, processedUrls, processedTitles);
    } else if (portalUrl.includes('suarakalbar.co.id')) {
      await scrapeSuaraKalbar(page, portalUrl, maxPages, delayMs, keywordList, result, processedUrls, processedTitles);
    } else {
      throw new Error('Unsupported portal. Currently only supports pontianakpost.jawapos.com, kalbaronline.com, kalbar.antaranews.com, and suarakalbar.co.id');
    }

    result.success = true;
    console.log(`Scraping completed. Total: ${result.totalScraped}, New: ${result.newItems}, Duplicates: ${result.duplicates}`);

  } catch (error: unknown) {
    console.error('Scraping error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown scraping error';
    result.errors.push(errorMessage);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return result;
}

// Helper function to parse Indonesian date strings
function parseIndonesianDate(dateString: string): Date {
  if (!dateString) {
    console.log('No date string provided, using current date');
    return new Date();
  }
  
  console.log(`=== PARSING DATE: "${dateString}" ===`);
  
  // Remove common prefixes and clean the string - more comprehensive
  const cleanedDate = dateString
    .replace(/^\s*(Dipublikasikan|Published|Tanggal|Date|Oleh|By|Posted|Diterbitkan|Terbit|Berita)[\s:]+/i, '')
    .replace(/^\s*(pada|on|at|di|dalam)[\s:]+/i, '')
    .replace(/^\s*(,|\-|\||–|—)\s*/g, '') // Remove leading separators
    .replace(/\s+(WIB|WITA|WIT|GMT|UTC|\+\d{2}:\d{2}).*$/i, '') // Remove timezone info
    .replace(/\s+pukul\s+\d{1,2}[:.]\d{2}.*$/i, '') // Remove time info like "pukul 14:30"
    .replace(/\s+\d{1,2}[:.]\d{2}([:.]\d{2})?.*$/i, '') // Remove time info like "14:30:00"
    .replace(/\s+jam\s+\d{1,2}[:.]\d{2}.*$/i, '') // Remove "jam 14:30"
    .replace(/\s*\(\s*\d+\s*(hari|minggu|bulan|tahun)\s+.*?\)\s*/gi, '') // Remove relative dates in parentheses
    .replace(/\s*-\s*\d+\s+(hari|minggu|bulan|tahun)\s+.*$/gi, '') // Remove "- 2 hari yang lalu" etc
    .trim();
  
  console.log(`Cleaned date: "${cleanedDate}"`);
  
  // Indonesian month mapping - more comprehensive
  const monthMap: { [key: string]: number } = {
    'januari': 0, 'jan': 0, 'january': 0,
    'februari': 1, 'feb': 1, 'pebruari': 1, 'february': 1,
    'maret': 2, 'mar': 2, 'march': 2,
    'april': 3, 'apr': 3,
    'mei': 4, 'may': 4,
    'juni': 5, 'jun': 5, 'june': 5,
    'juli': 6, 'jul': 6, 'july': 6,
    'agustus': 7, 'agu': 7, 'aug': 7, 'ags': 7, 'august': 7,
    'september': 8, 'sep': 8, 'sept': 8,
    'oktober': 9, 'okt': 9, 'oct': 9, 'october': 9,
    'november': 10, 'nov': 10, 'nop': 10,
    'desember': 11, 'des': 11, 'dec': 11, 'december': 11
  };
  
  try {
    // Try standard ISO format first (YYYY-MM-DDTHH:mm:ss)
    const isoDate = new Date(cleanedDate);
    if (!isNaN(isoDate.getTime()) && cleanedDate.includes('T') || cleanedDate.match(/^\d{4}-\d{2}-\d{2}/)) {
      console.log(`Parsed as ISO date: ${isoDate.toISOString()}`);
      return new Date(isoDate.getFullYear(), isoDate.getMonth(), isoDate.getDate());
    }
    
    // Enhanced patterns for Indonesian dates - prioritized by common usage
    const patterns = [
      // ISO format with timezone: "2024-01-15T10:30:00+07:00"
      /(\d{4})-(\d{1,2})-(\d{1,2})T\d{2}:\d{2}:\d{2}/,
      // ISO format: "2024-01-15" 
      /(\d{4})-(\d{1,2})-(\d{1,2})$/,
      // DD Bulan YYYY (e.g., "15 Januari 2024", "15 Jan 2024") - Most common Indonesian format
      /(\d{1,2})\s+(\w+)\s+(\d{4})/i,
      // Long format like "Senin, 15 Januari 2024" or "Kamis, 15 Jan 2024"
      /\w+,?\s+(\d{1,2})\s+(\w+)\s+(\d{4})/i,
      // Format with time like "15 Januari 2024, 14:30"
      /(\d{1,2})\s+(\w+)\s+(\d{4})[,\s]+\d{1,2}[:.]\d{2}/i,
      // Bulan DD, YYYY (e.g., "Januari 15, 2024") - Less common but possible
      /(\w+)\s+(\d{1,2}),?\s+(\d{4})/i,
      // DD-MM-YYYY or DD/MM/YYYY (Indonesian format)
      /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/,
      // YYYY-MM-DD or YYYY/MM/DD (ISO format)
      /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/,
      // DD Bulan (current year) e.g., "15 Januari"
      /(\d{1,2})\s+(\w+)$/i,
      // Just year YYYY
      /^(\d{4})$/
    ];
    
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = cleanedDate.match(pattern);
      console.log(`Pattern ${i} (${pattern}): ${match ? 'MATCH' : 'no match'}`);
      
      if (match) {
        console.log(`Pattern ${i} matched:`, match);
        
        let result: Date | null = null;
        
        if (i === 0) {
          // ISO format with timezone: "2024-01-15T10:30:00+07:00"
          const year = parseInt(match[1]);
          const month = parseInt(match[2]) - 1; // Month is 0-indexed
          const day = parseInt(match[3]);
          
          if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 2000) {
            result = new Date(year, month, day);
          }
        } else if (i === 1) {
          // ISO format: "2024-01-15"
          const year = parseInt(match[1]);
          const month = parseInt(match[2]) - 1;
          const day = parseInt(match[3]);
          
          if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 2000) {
            result = new Date(year, month, day);
          }
        } else if (i === 2 || i === 3 || i === 4) {
          // DD Bulan YYYY format or variations (including with day names and time)
          const day = parseInt(match[1]);
          const monthName = match[2].toLowerCase();
          const year = parseInt(match[3]) || new Date().getFullYear();
          const month = monthMap[monthName];
          
          console.log(`Parsing Indonesian format: day=${day}, monthName=${monthName}, month=${month}, year=${year}`);
          
          if (month !== undefined && day >= 1 && day <= 31 && year >= 2000) {
            result = new Date(year, month, day);
          }
        } else if (i === 5) {
          // Bulan DD, YYYY format
          const monthName = match[1].toLowerCase();
          const day = parseInt(match[2]);
          const year = parseInt(match[3]);
          const month = monthMap[monthName];
          
          if (month !== undefined && day >= 1 && day <= 31 && year >= 2000) {
            result = new Date(year, month, day);
          }
        } else if (i === 6) {
          // DD-MM-YYYY format (Indonesian format)
          const day = parseInt(match[1]);
          const month = parseInt(match[2]) - 1; // Month is 0-indexed
          const year = parseInt(match[3]);
          
          if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 2000) {
            result = new Date(year, month, day);
          }
        } else if (i === 7) {
          // YYYY-MM-DD format
          const year = parseInt(match[1]);
          const month = parseInt(match[2]) - 1;
          const day = parseInt(match[3]);
          
          if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 2000) {
            result = new Date(year, month, day);
          }
        } else if (i === 8) {
          // DD Bulan (current year)
          const day = parseInt(match[1]);
          const monthName = match[2].toLowerCase();
          const year = new Date().getFullYear();
          const month = monthMap[monthName];
          
          if (month !== undefined && day >= 1 && day <= 31) {
            result = new Date(year, month, day);
          }
        } else if (i === 9) {
          // Just year
          const year = parseInt(match[1]);
          if (year >= 2000 && year <= new Date().getFullYear() + 1) {
            result = new Date(year, 0, 1); // January 1st of that year
          }
        }
        
        if (result) {
          console.log(`✓ Successfully parsed with pattern ${i}: ${result.toISOString().split('T')[0]} (${result.toLocaleDateString('id-ID')})`);
          return result;
        } else {
          console.log(`✗ Pattern ${i} matched but date validation failed`);
        }
      }
    }
    
    // If all parsing failed, return current date
    console.log(`⚠ FAILED to parse date: "${dateString}" (cleaned: "${cleanedDate}")`);
    console.log(`Using current date as fallback: ${new Date().toISOString().split('T')[0]}`);
    console.log('=== END DATE PARSING ===');
    return new Date();
    
  } catch (error) {
    console.log(`❌ ERROR parsing date: "${dateString}" - ${error}`);
    console.log(`Using current date as fallback: ${new Date().toISOString().split('T')[0]}`);
    console.log('=== END DATE PARSING ===');
    return new Date();
  }
}

// Helper function to clean content from CSS and unwanted elements
function cleanContent(content: string): string {
  if (!content) return '';
  
  return content
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    .trim()
    // Remove common unwanted phrases
    .replace(/^\s*(Baca juga|Baca Juga|BACA JUGA|Artikel terkait|Artikel Terkait).*$/gim, '')
    .replace(/^\s*(Sumber|Source).*$/gim, '')
    .replace(/^\s*(Editor|Reporter).*$/gim, '')
    // Remove Kalbar Online template text
    .replace(/Follow KalbarOnline\.com untuk mendapatkan informasi terkini\. Klik untuk follow WhatsApp Channel & Google News\./gi, '')
    .replace(/Follow KalbarOnline\.com.*?Google News\./gi, '')
    // Remove social media links patterns
    .replace(/https?:\/\/(www\.)?(facebook|twitter|instagram|whatsapp)\.com[^\s]*/gi, '')
    // Remove email addresses
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '')
    // Clean up multiple spaces again
    .replace(/\s+/g, ' ')
    .trim();
}

async function scrapePontianakPost(
  page: Page, 
  baseUrl: string, 
  maxPages: number, 
  delayMs: number,
  keywords: string[],
  result: ScrapingResult,
  processedUrls: Set<string>,
  processedTitles: Set<string>
): Promise<void> {
  let currentPage = 1;

  while (currentPage <= maxPages) {
    try {
      const pageUrl = currentPage === 1 ? baseUrl : `${baseUrl}?page=${currentPage}`;
      console.log(`Scraping page ${currentPage}: ${pageUrl}`);

      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Wait for page content to load
      await page.waitForLoadState('domcontentloaded');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for dynamic content
      
      // Check if we can find any content containers
      const hasContent = await page.evaluate(() => {
        const selectors = [
          'article', '.post', '.news-item', '.card', '.entry', 
          'div[class*="post"]', 'div[class*="article"]', 'div[class*="news"]',
          'a[href*="/"][href*="20"]', 'a[title]'
        ];
        
        for (const selector of selectors) {
          if (document.querySelector(selector)) {
            return true;
          }
        }
        return false;
      });
      
      if (!hasContent) {
        console.log('No content found on page, skipping...');
        continue;
      }

      // Extract article links and titles - specifically from "berita terkini" section
      const articles = await page.evaluate(() => {
        let articleElements: NodeListOf<Element> | null = null;
        
        // Priority 1: SPECIFIC selector for Pontianakpost structure
        const latestNewsSections = [
          // EXACT structure for Pontianakpost - h2.latest__title contains title and link
          '.latest.m3.clearfix h2.latest__title',
          '.latest.m3 h2.latest__title', // Alternative without clearfix
          
          // Fallback selectors for pontianakpost structure variations
          '.latest h2.latest__title',
          'h2.latest__title', // Direct selector if section class changes
          
          // Additional fallback for latest section structure
          '.latest.m3.clearfix h2',
          '.latest.m3 h2',
          '.latest h2',
        ];
        
        for (const selector of latestNewsSections) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            articleElements = elements;
            console.log(`✅ [PONTIANAKPOST] Found ${elements.length} articles in LATEST NEWS section using selector: "${selector}"`);
            
            // Special debug for the exact class user mentioned
            if (selector.includes('.latest.m3.clearfix')) {
              console.log(`🎯 SUCCESS: Using the exact pontianakpost "latest m3 clearfix" section!`);
              // Debug: log the section content
              const sectionElement = document.querySelector('.latest.m3.clearfix');
              if (sectionElement) {
                console.log(`Section HTML preview: ${sectionElement.innerHTML.substring(0, 200)}...`);
              }
            }
            break;
          }
        }
        
        // Priority 2: If no specific latest news section found, exclude popular sections
        if (!articleElements || articleElements.length === 0) {
          console.log('❌ [PONTIANAKPOST] No specific latest news section found, trying to exclude popular sections...');
          
          // Special debug: check if the exact section exists but has no articles
          const latestSection = document.querySelector('.latest.m3.clearfix');
          if (latestSection) {
            console.log('🔍 [PONTIANAKPOST] Found .latest.m3.clearfix section but no articles inside!');
            console.log(`Section HTML: ${latestSection.innerHTML.substring(0, 300)}...`);
            console.log(`Section children count: ${latestSection.children.length}`);
            
            // Try to find any links or content in the section
            const linksInSection = latestSection.querySelectorAll('a[href*="/"]');
            console.log(`Links found in section: ${linksInSection.length}`);
            if (linksInSection.length > 0) {
              console.log('Sample links:');
              Array.from(linksInSection).slice(0, 3).forEach((link, index) => {
                console.log(`  ${index + 1}. ${link.textContent?.trim()} -> ${link.getAttribute('href')}`);
              });
            }
          } else {
            console.log('❌ [PONTIANAKPOST] .latest.m3.clearfix section NOT FOUND on page!');
            // Debug: show what sections are available
            const availableSections = document.querySelectorAll('[class*="latest"], [class*="recent"], [class*="terkini"]');
            console.log(`Available sections with "latest/recent/terkini": ${availableSections.length}`);
            Array.from(availableSections).forEach((section, index) => {
              console.log(`  ${index + 1}. ${section.tagName}.${section.className}`);
            });
          }
          
          const excludePopularSelectors = [
            // Get all articles but exclude those in popular/terpopuler sections
            'article:not(.popular):not(.terpopuler):not([class*="popular"]):not([class*="terpopuler"])',
            '.post:not(.popular):not(.terpopuler):not([class*="popular"]):not([class*="terpopuler"])',
            '.news-item:not(.popular):not(.terpopuler):not([class*="popular"]):not([class*="terpopuler"])',
            '.card:not(.popular):not(.terpopuler):not([class*="popular"]):not([class*="terpopuler"])',
            '.entry:not(.popular):not(.terpopuler):not([class*="popular"]):not([class*="terpopuler"])',
            'div[class*="post"]:not([class*="popular"]):not([class*="terpopuler"])',
            'div[class*="article"]:not([class*="popular"]):not([class*="terpopuler"])',
            'div[class*="news"]:not([class*="popular"]):not([class*="terpopuler"])',
            'div[class*="item"]:not([class*="popular"]):not([class*="terpopuler"])',
          ];
          
          for (const selector of excludePopularSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              articleElements = elements;
              console.log(`Found ${elements.length} articles excluding popular sections using selector: ${selector}`);
              break;
            }
          }
        }
        
        // Priority 3: Fallback to main content area (exclude sidebar and widgets)
        if (!articleElements || articleElements.length === 0) {
          console.log('Using fallback to main content area...');
          
          const mainContentSelectors = [
            'main article, main .post, main .news-item, main .card, main .entry',
            '.main-content article, .main-content .post, .main-content .news-item',
            '.content-main article, .content-main .post, .content-main .news-item',
            '#main article, #main .post, #main .news-item',
            '#content article, #content .post, #content .news-item',
          ];
          
          for (const selector of mainContentSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              articleElements = elements;
              console.log(`Found ${elements.length} articles in main content using selector: ${selector}`);
              break;
            }
          }
        }
        
        // Priority 4: Last resort - generic selectors but with additional filtering
        if (!articleElements || articleElements.length === 0) {
          console.log('Using last resort generic selectors...');
          articleElements = document.querySelectorAll('article, .post, .news-item, .card, .entry, div[class*="post"], div[class*="article"], div[class*="news"], div[class*="item"]');
        }
        
        // If still no specific containers found, try to find any links that look like articles
        if (!articleElements || articleElements.length === 0) {
          console.log('No containers found, trying direct link approach...');
          // Try different approaches to find article links
          const linkSelectors = [
            'a[href*="/"][href*="20"]:not(.popular a):not(.terpopuler a)', // Links with year, exclude popular
            'a[href*="/"][title]:not(.popular a):not(.terpopuler a)', // Links with title attribute, exclude popular
            'a[href*="/artikel"]:not(.popular a):not(.terpopuler a)', // Links with "artikel" in URL, exclude popular
            'a[href*="/berita"]:not(.popular a):not(.terpopuler a)', // Links with "berita" in URL, exclude popular
            'a[href*="/news"]:not(.popular a):not(.terpopuler a)', // Links with "news" in URL, exclude popular
            'a[href*="/"][href*="20"]', // Fallback: Links with year in them (likely news)
            'a[href*="/"][title]', // Fallback: Links with title attribute
            'a[href*="/artikel"]', // Fallback: Links with "artikel" in URL
            'a[href*="/berita"]', // Fallback: Links with "berita" in URL
            'a[href*="/news"]' // Fallback: Links with "news" in URL
          ];
          
          for (const selector of linkSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              articleElements = elements;
              console.log(`Found ${elements.length} articles using link selector: ${selector}`);
              break;
            }
          }
        }
        
        const articles = [];

        for (const element of articleElements) {
          let title = '';
          let href = '';
          let dateString = '';
          
          if (element.tagName === 'H2' && element.classList.contains('latest__title')) {
            // PONTIANAKPOST SPECIFIC: h2.latest__title structure
            const linkElement = element.querySelector('a[href*="/"]');
            if (linkElement) {
              title = linkElement.textContent?.trim() || '';
              href = linkElement.getAttribute('href') || '';
              
              // Find associated date - look for sibling or nearby .latest__date
              const parentElement = element.parentElement;
              let dateElement = null;
              
              if (parentElement) {
                // Try to find date in same parent container
                dateElement = parentElement.querySelector('.latest__date, span.latest__date');
                
                // If not found, try in next sibling elements
                if (!dateElement) {
                  let nextSibling = element.nextElementSibling;
                  while (nextSibling && !dateElement) {
                    if (nextSibling.classList.contains('latest__date') || 
                        nextSibling.querySelector('.latest__date')) {
                      dateElement = nextSibling.classList.contains('latest__date') ? 
                                  nextSibling : nextSibling.querySelector('.latest__date');
                      break;
                    }
                    nextSibling = nextSibling.nextElementSibling;
                  }
                }
              }
              
              if (dateElement) {
                dateString = dateElement.textContent?.trim() || '';
              }
              
              console.log(`🎯 [PONTIANAKPOST] Found h2.latest__title: "${title.substring(0, 50)}..." | Date: "${dateString}"`);
            }
          } else if (element.tagName === 'H2') {
            // Fallback for h2 without latest__title class
            const linkElement = element.querySelector('a[href*="/"]');
            if (linkElement) {
              title = linkElement.textContent?.trim() || '';
              href = linkElement.getAttribute('href') || '';
              console.log(`⚠️ [PONTIANAKPOST] Found h2 (not latest__title): "${title.substring(0, 50)}..."`);
            }
          }
          
          if (title && href && title.length > 5) {
            const fullLink = href.startsWith('http') ? href : 'https://pontianakpost.jawapos.com' + href;
            articles.push({
              title,
              link: fullLink,
              dateString // Include date for later processing
            });
            
            // Debug for articles from the exact section
            const isFromExactSection = element.closest('.latest.m3.clearfix') !== null;
            if (isFromExactSection) {
              console.log(`✅ Article from EXACT .latest.m3.clearfix section: "${title.substring(0, 50)}..."`);
            }
          }
        }

        // Additional filtering: exclude articles that are clearly from popular/terpopuler sections based on content
        const filteredArticles = articles.filter(article => {
          const titleLower = article.title.toLowerCase();
          const linkLower = article.link.toLowerCase();
          
          // Skip articles that contain popular/trending indicators in title or URL
          const popularIndicators = ['terpopuler', 'popular', 'trending', 'viral', 'paling dibaca', 'most read'];
          const hasPopularIndicator = popularIndicators.some(indicator => 
            titleLower.includes(indicator) || linkLower.includes(indicator)
          );
          
          if (hasPopularIndicator) {
            console.log(`Excluding popular article: ${article.title.substring(0, 30)}...`);
            return false;
          }
          
          return true;
        });
        
        console.log(`Original articles: ${articles.length}, After filtering popular: ${filteredArticles.length}`);
        return filteredArticles;
      });

      console.log(`✓ [PONTIANAKPOST] Found ${articles.length} articles on page ${currentPage}`);
      
      // Enhanced debug: Validate 20 articles per page expectation
      if (articles.length > 0) {
        console.log('=== PONTIANAKPOST SCRAPING DEBUG ===');
        console.log(`Page URL: ${pageUrl}`);
        console.log(`Expected: 20 articles per page | Actual: ${articles.length} articles`);
        
        if (articles.length !== 20) {
          console.log(`⚠️ [PONTIANAKPOST] WARNING: Expected 20 articles, got ${articles.length}!`);
          if (articles.length < 20) {
            console.log('   This might indicate: incomplete page load, different page structure, or fewer articles available');
          } else {
            console.log('   This might indicate: selector capturing extra elements beyond the latest section');
          }
        } else {
          console.log('✅ [PONTIANAKPOST] Perfect! Got exactly 20 articles as expected');
        }
        
        console.log('Sample articles found:');
        articles.slice(0, 5).forEach((article, index) => {
          console.log(`  ${index + 1}. Title: "${article.title.substring(0, 60)}${article.title.length > 60 ? '...' : ''}"`);
          console.log(`     Link: ${article.link}`);
          console.log(`     Date: "${article.dateString || 'No date found'}"`);
        });
        
        // Count articles with dates
        const articlesWithDates = articles.filter(a => a.dateString && a.dateString.trim()).length;
        console.log(`📅 Articles with dates: ${articlesWithDates}/${articles.length}`);
        
        console.log('=== END DEBUG ===');
      } else {
        // Debug: Check page content
        const pageInfo = await page.evaluate(() => {
          return {
            title: document.title,
            url: window.location.href,
            linksCount: document.querySelectorAll('a').length,
            bodyText: document.body ? document.body.innerText.substring(0, 200) + '...' : 'No body'
          };
        });
        console.log('Page debug info:', pageInfo);
      }

      // Filter articles by keywords in title
      const relevantArticles = articles.filter(article => 
        keywords.some(keyword => 
          article.title.toLowerCase().includes(keyword)
        )
      );

      console.log(`Found ${relevantArticles.length} relevant articles (containing keywords)`);
      
      // If no articles found at all, might be end of content or blocked
      if (articles.length === 0) {
        console.log(`No articles found on page ${currentPage}, stopping pagination`);
        break;
      }
      
      // Enhanced logging for pagination continuation
      if (relevantArticles.length === 0) {
        console.log(`⚠ No relevant articles (matching keywords) found on PontianakPost page ${currentPage}, but continuing to next page...`);
        console.log(`Total articles found: ${articles.length}, Keywords: [${keywords.join(', ')}]`);
      } else {
        console.log(`✓ Processing ${relevantArticles.length} relevant articles from PontianakPost page ${currentPage}...`);
        console.log(`Relevant articles (first 3):`);
        relevantArticles.slice(0, 3).forEach((article, index) => {
          const matchedKws = keywords.filter(kw => article.title.toLowerCase().includes(kw));
          console.log(`  ${index + 1}. "${article.title.substring(0, 50)}..." [Keywords: ${matchedKws.join(', ')}]`);
        });
      }

      // Scrape content from relevant articles
      for (const article of relevantArticles) {
        try {
          await page.goto(article.link, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await new Promise(resolve => setTimeout(resolve, delayMs)); // Rate limiting

          // Extract article content
          const articleData = await page.evaluate(({ articleTitle, articleLink }) => {
            // Try multiple selectors for content - more comprehensive list
            const contentSelectors = [
              // Common content selectors
              '.post-content',
              '.article-content', 
              '.content',
              '.entry-content',
              'article .content',
              '.post-body',
              '.article-body',
              
              // Additional selectors for various CMS
              '.single-content',
              '.text-content',
              '.main-content',
              '.news-content',
              '.story-content',
              '.body-text',
              
              // Generic selectors
              'article p',
              '.content p',
              'main p',
              
              // Very generic fallback
              'p'
            ];

            let content = '';
            let usedSelector = '';
            
            for (const selector of contentSelectors) {
              const contentElement = document.querySelector(selector);
              if (contentElement) {
                let tempContent = '';
                
                // If selector targets paragraphs, collect all paragraph text
                if (selector.includes('p')) {
                  const paragraphs = document.querySelectorAll(selector);
                  tempContent = Array.from(paragraphs)
                    .map(p => p.textContent?.trim())
                    .filter(text => text && text.length > 20) // Filter out short paragraphs
                    .join(' ');
                } else {
                  tempContent = contentElement.textContent?.trim() || '';
                }
                
                if (tempContent.length > 100) { // Use the selector that gives substantial content
                  content = tempContent;
                  usedSelector = selector;
                  break;
                }
              }
            }
            
            // Debug info - log which selector worked
            if (usedSelector) {
              console.log(`Content extracted using selector: ${usedSelector}, length: ${content.length}`);
            } else {
              // If no content found, try to debug what's available
              const bodyText = document.body?.innerText || '';
              console.log(`No content selector worked. Body text length: ${bodyText.length}, First 200 chars: ${bodyText.substring(0, 200)}`);
            }

            // Debug: Let's capture ALL potential date elements for analysis
            const allDateElements = [];
            
            // Comprehensive date selectors for debugging
            const debugSelectors = [
              // Time elements
              'time',
              '[datetime]',
              // Common date classes
              '.date', '.post-date', '.published-date', '.entry-date', '.meta-date',
              // Meta sections
              '.meta', '.post-meta', '.entry-meta', '.article-meta', '.meta-info',
              '.post-info', '.article-info', '.byline', '.meta-data', '.post-details',
              // Author/date sections
              '.author-date', '.post-author', '.entry-author',
              // Generic containers that might contain dates
              '.post-header', '.entry-header', '.article-header',
              '.post-footer', '.entry-footer', '.article-footer'
            ];
            
            // Collect all elements for debugging
            debugSelectors.forEach(selector => {
              const elements = document.querySelectorAll(selector);
              elements.forEach(el => {
                const text = el.textContent?.trim() || '';
                const datetime = el.getAttribute('datetime') || '';
                const content = el.getAttribute('content') || '';
                
                if (text || datetime || content) {
                  allDateElements.push({
                    selector: selector,
                    element: el.tagName + (el.className ? '.' + el.className.split(' ').join('.') : ''),
                    text: text.substring(0, 100), // Limit length for debugging
                    datetime: datetime,
                    content: content,
                    innerHTML: el.innerHTML?.substring(0, 200) || '' // First 200 chars of HTML
                  });
                }
              });
            });
            
            // Also check meta tags
            const metaSelectors = [
              'meta[property*="time"]',
              'meta[property*="date"]', 
              'meta[name*="date"]',
              'meta[itemprop*="date"]',
              'meta[property="article:published_time"]',
              'meta[property="article:modified_time"]',
              'meta[name="DC.date.issued"]',
              'meta[itemprop="datePublished"]',
              'meta[itemprop="dateModified"]'
            ];
            
            metaSelectors.forEach(selector => {
              const elements = document.querySelectorAll(selector);
              elements.forEach(el => {
                const content = el.getAttribute('content') || '';
                const property = el.getAttribute('property') || el.getAttribute('name') || el.getAttribute('itemprop') || '';
                if (content) {
                  allDateElements.push({
                    selector: selector,
                    element: 'META',
                    text: '',
                    datetime: '',
                    content: content,
                    property: property
                  });
                }
              });
            });
            
            console.log('=== PONTIANAK POST DATE DEBUG ===');
            console.log('URL:', window.location.href);
            console.log('Title:', document.title);
            console.log('All potential date elements found:', allDateElements);
            
            // Now try to find the best date using enhanced selectors - prioritized for Pontianak Post
            const dateSelectors = [
              // Time elements with datetime attribute (highest priority)
              'time[datetime]',
              '[datetime]',
              // Pontianak Post specific selectors
              '.date-info',
              '.publish-date',
              '.article-date',
              '.news-date',
              // Common WordPress date selectors
              '.post-date',
              '.published-date', 
              '.entry-date',
              '.date',
              'time',
              '.meta-date',
              // Meta sections
              '.post-meta', '.entry-meta', '.article-meta', '.meta-info',
              '.post-info', '.article-info', '.byline',
              // Author sections (often contain dates)
              '.post-author', '.entry-author', '.author-date',
              // Header/footer sections
              '.post-header', '.entry-header', '.post-footer', '.entry-footer',
              // Additional selectors for Pontianak Post
              '.meta', '.meta-data', '.post-details',
              'span[class*="date"]', 'div[class*="date"]',
              '.content-meta', '.article-info'
            ];

            let dateString = '';
            let foundSelector = '';
            
            for (const selector of dateSelectors) {
              const dateElements = document.querySelectorAll(selector);
              
              for (const dateElement of dateElements) {
                // Try multiple ways to get date text
                const potentialDate = dateElement.getAttribute('datetime') || 
                                  dateElement.getAttribute('content') ||
                                  dateElement.textContent?.trim() || '';
                                  
                if (potentialDate && potentialDate.length > 5) {
                  // Check if this looks like a date - enhanced validation
                  const hasNumbers = /\d/.test(potentialDate);
                  const hasDateKeywords = /\b(20\d{2}|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(potentialDate);
                  const hasDateFormats = potentialDate.includes('-') || potentialDate.includes('/') || potentialDate.includes('T') || potentialDate.includes(',');
                  
                  // Enhanced date pattern detection
                  const commonDatePatterns = [
                    /\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/, // DD/MM/YYYY or DD-MM-YYYY
                    /\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/, // YYYY/MM/DD or YYYY-MM-DD
                    /\d{1,2}\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+\d{4}/i, // DD Month YYYY
                    /\d{1,2}:\d{2}/, // Has time (likely includes date too)
                    /\b\d{4}\b/ // Has a year
                  ];
                  
                  const matchesPattern = commonDatePatterns.some(pattern => pattern.test(potentialDate));
                  
                  if (hasNumbers && (hasDateKeywords || hasDateFormats || matchesPattern)) {
                    // Additional check: exclude obviously non-date content
                    const excludePatterns = [
                      /^https?:\/\//, // URLs
                      /^#/, // Hashtags
                      /^\d+$/, // Just a number
                      /views?/i, // View counts
                      /share/i, // Share buttons
                      /comment/i, // Comments
                      /like/i // Likes
                    ];
                    
                    const isExcluded = excludePatterns.some(pattern => pattern.test(potentialDate.trim()));
                    
                    if (!isExcluded) {
                      dateString = potentialDate;
                      foundSelector = selector;
                      console.log(`Found date using selector "${selector}": ${dateString}`);
                      break;
                    }
                  }
                }
              }
              
              if (dateString) break;
            }
            
            // If still no date found, try meta tags
            if (!dateString) {
              const metaSelectors = [
                'meta[property="article:published_time"]',
                'meta[property="article:modified_time"]',
                'meta[name="DC.date.issued"]',
                'meta[name="date"]',
                'meta[itemprop="datePublished"]',
                'meta[itemprop="dateModified"]'
              ];
              
              for (const selector of metaSelectors) {
                const metaElement = document.querySelector(selector);
                if (metaElement) {
                  const content = metaElement.getAttribute('content') || '';
                  if (content) {
                    dateString = content;
                    foundSelector = selector;
                    console.log(`Found date using meta selector "${selector}": ${dateString}`);
                    break;
                  }
                }
              }
            }
            
            console.log('Final selected date:', dateString, 'from selector:', foundSelector);
            console.log('=== END DATE DEBUG ===');

            // If still no content, try one last aggressive approach
            if (!content) {
              // Get all text from body, but exclude navigation, ads, etc.
              const excludeSelectors = [
                'nav', 'header', 'footer', '.navigation', '.menu', 
                '.sidebar', '.widget', '.advertisement', '.ads',
                '.related', '.comments', '.social', 'script', 'style'
              ];
              
              // Remove excluded elements temporarily
              const excludedElements = [];
              excludeSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                  excludedElements.push({ element: el, parent: el.parentNode });
                  el.remove();
                });
              });
              
              // Get main content
              const mainContent = document.querySelector('main') || document.body;
              if (mainContent) {
                const allText = mainContent.innerText || '';
                if (allText.length > 200) {
                  content = allText.trim();
                }
              }
              
              // Restore excluded elements
              excludedElements.forEach(({ element, parent }) => {
                if (parent) {
                  parent.appendChild(element);
                }
              });
            }

            return {
              title: articleTitle,
              content: content || 'Content could not be extracted',
              link: articleLink,
              dateString,
            };
          }, { articleTitle: article.title, articleLink: article.link });

          // Parse date - prefer date from list page (latest__date), fallback to article page
          let articleDate: Date;
          let dateSource = '';
          
          // Priority 1: Use date from list page (latest__date)
          if (article.dateString && article.dateString.trim()) {
            console.log(`\n🔍 [PONTIANAKPOST] Processing article: "${articleData.title.substring(0, 60)}..."`);
            console.log(`📅 Using date from list page (.latest__date): "${article.dateString}"`);
            console.log(`🔗 Article URL: ${articleData.link}`);
            articleDate = parseIndonesianDate(article.dateString);
            dateSource = 'list_page (.latest__date)';
          }
          // Priority 2: Use date from article page if list page date not available
          else if (articleData.dateString) {
            console.log(`\n🔍 [PONTIANAKPOST] Processing article: "${articleData.title.substring(0, 60)}..."`);
            console.log(`📅 Using date from article page: "${articleData.dateString}"`);
            console.log(`🔗 Article URL: ${articleData.link}`);
            articleDate = parseIndonesianDate(articleData.dateString);
            dateSource = 'article_page';
          }
          // Fallback: Current date
          else {
            articleDate = new Date();
            console.log(`\n❌ [PONTIANAKPOST] NO DATE FOUND for "${articleData.title.substring(0, 60)}..."`);
            console.log(`🔗 Article URL: ${articleData.link}`);
            console.log(`Using current date as fallback: ${articleDate.toISOString().split('T')[0]}`);
            dateSource = 'fallback (current date)';
          }
          
          // Validate parsed date
          if (dateSource !== 'fallback (current date)') {
            const wasCurrentDate = Math.abs(articleDate.getTime() - new Date().getTime()) < 24 * 60 * 60 * 1000; // Within 24 hours
            if (wasCurrentDate) {
              console.log(`⚠️  WARNING: Date parsing may have failed - using current date (${articleDate.toISOString().split('T')[0]})`);
              console.log(`   Date source: ${dateSource}`);
            } else {
              console.log(`✅ Successfully parsed date: ${articleDate.toISOString().split('T')[0]} (${articleDate.toLocaleDateString('id-ID')})`);
              console.log(`   Date source: ${dateSource}`);
              
              // Additional validation: check if article is recent (not older than 30 days)
              const daysDiff = Math.floor((new Date().getTime() - articleDate.getTime()) / (1000 * 60 * 60 * 24));
              if (daysDiff > 30) {
                console.log(`⚠️  NOTE: Article is ${daysDiff} days old - might be from popular section instead of latest news`);
              } else {
                console.log(`✅ Article age: ${daysDiff} days (recent)`);
              }
            }
          }

          // Find matched keywords
          const matchedKeywords = keywords.filter(keyword => 
            articleData.title.toLowerCase().includes(keyword) || 
            articleData.content.toLowerCase().includes(keyword)
          );

          if (matchedKeywords.length > 0) {
            // Check for duplicates before processing
            const isDuplicate = await checkDuplicateArticle(
              articleData.title, 
              articleData.link, 
              processedUrls, 
              processedTitles
            );
            
            if (isDuplicate) {
              result.duplicates++;
              console.log(`⚠ [PONTIANAKPOST] Skipping duplicate: ${articleData.title.substring(0, 50)}...`);
              continue;
            }
            
            // Add to processed sets
            processedUrls.add(articleData.link.toLowerCase());
            processedTitles.add(articleData.title.toLowerCase().trim());

            const scrapedItem: ScrapedNewsItem = {
              title: articleData.title,
              content: articleData.content,
              link: articleData.link,
              date: articleDate,
              portal: 'pontianakpost.jawapos.com',
              matchedKeywords,
            };

            // Generate unique ID for the news
            const idBerita = `pp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Try to save to database
            try {
              await saveScrapedArticle({
                idBerita,
                portalBerita: scrapedItem.portal,
                linkBerita: scrapedItem.link,
                judul: scrapedItem.title,
                isi: scrapedItem.content,
                tanggalBerita: scrapedItem.date,
                matchedKeywords: scrapedItem.matchedKeywords,
              });

              // Update keyword match counts
              await incrementKeywordMatchCount(scrapedItem.matchedKeywords);

              result.newItems++;
              result.scrapedItems.push(scrapedItem);
              console.log(`✓ [PONTIANAKPOST] SAVED: ${scrapedItem.title.substring(0, 50)}...`);
              console.log(`  📅 Date: ${scrapedItem.date.toISOString().split('T')[0]}`);
              console.log(`  🏷️  Keywords: [${scrapedItem.matchedKeywords.join(', ')}]`);

            } catch (dbError: unknown) {
              if ((dbError as { code?: string }).code === 'P2002') {
                result.duplicates++;
                console.log(`⚠ Duplicate: ${scrapedItem.title.substring(0, 50)}...`);
              } else {
                const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
                result.errors.push(`Database error: ${errorMessage}`);
                console.error('Database error:', dbError);
              }
            }

            result.totalScraped++;
          }

        } catch (articleError: unknown) {
          const errorMessage = articleError instanceof Error ? articleError.message : 'Unknown article error';
          console.error(`Error scraping article ${article.link}:`, errorMessage);
          result.errors.push(`Article error: ${errorMessage}`);
        }
      }

      // Check if we should continue to next page - PONTIANAKPOST SPECIFIC
      const hasNextPage = await page.evaluate((currentPageNum) => {
        // Look for paging items specifically for pontianakpost
        const pagingItems = document.querySelectorAll('div.paging__item a, .paging__item a');
        
        if (pagingItems.length === 0) {
          console.log('❌ [PONTIANAKPOST] No paging items found (.paging__item)');
          // Fallback to generic pagination selectors
          const genericNext = document.querySelector('a[href*="page"]:last-child, .next, .pagination .next, a[href*="' + (currentPageNum + 1) + '"]');
          return genericNext && !genericNext.classList.contains('disabled');
        }
        
        // Check if there's a link to the next page number
        const nextPageNum = currentPageNum + 1;
        let hasNext = false;
        
        pagingItems.forEach((item) => {
          const href = item.getAttribute('href') || '';
          const text = item.textContent?.trim() || '';
          
          // Check if this link goes to the next page
          if (href.includes('page=' + nextPageNum) || 
              href.includes('/' + nextPageNum) ||
              text === nextPageNum.toString() ||
              (text.toLowerCase().includes('next') && !item.classList.contains('disabled'))) {
            hasNext = true;
            console.log(`✅ [PONTIANAKPOST] Found next page link: ${href} (text: "${text}")`);
          }
        });
        
        if (!hasNext) {
          console.log(`❌ [PONTIANAKPOST] No next page found for page ${nextPageNum}`);
          console.log('Available paging links:');
          pagingItems.forEach((item, index) => {
            console.log(`  ${index + 1}. "${item.textContent?.trim()}" -> ${item.getAttribute('href')}`);
          });
        }
        
        return hasNext;
      }, currentPage);

      if (!hasNextPage) {
        console.log('No more pages found, stopping pagination');
        break;
      }

      // Summary for this page
      console.log(`\n=== PONTIANAKPOST PAGE ${currentPage} SUMMARY ===`);
      console.log(`Total articles found: ${articles.length} (Expected: 20)`);
      console.log(`Relevant articles (with keywords): ${relevantArticles.length}`);
      console.log(`Articles processed in this page: ${relevantArticles.length}`);
      console.log(`Articles with dates: ${articles.filter(a => a.dateString && a.dateString.trim()).length}/${articles.length}`);
      console.log(`Running total - New items: ${result.newItems}, Duplicates: ${result.duplicates}`);
      
      // Additional pontianakpost-specific validations
      const h2LatestTitleCount = articles.filter(a => a.title && a.link).length;
      console.log(`h2.latest__title articles captured: ${h2LatestTitleCount}/${articles.length}`);
      
      console.log(`=== END PAGE SUMMARY ===\n`);

      currentPage++;
      await new Promise(resolve => setTimeout(resolve, delayMs)); // Rate limiting between pages

    } catch (pageError: unknown) {
      const errorMessage = pageError instanceof Error ? pageError.message : 'Unknown page error';
      console.error(`❌ Error scraping PontianakPost page ${currentPage}:`, errorMessage);
      result.errors.push(`Page ${currentPage} error: ${errorMessage}`);
      break; // Stop pagination on page error
    }
  }
  
  // Final summary for PontianakPost scraping
  console.log(`\n🎯 === PONTIANAKPOST SCRAPING COMPLETE ===`);
  console.log(`📄 Pages scraped: ${currentPage - 1}`);
  console.log(`📰 New articles saved: ${result.newItems}`);
  console.log(`🔄 Duplicates skipped: ${result.duplicates}`);
  console.log(`❌ Errors encountered: ${result.errors.length}`);
  console.log(`=== END PONTIANAKPOST SCRAPING ===\n`);
}

async function scrapeKalbarOnline(
  page: Page, 
  baseUrl: string, 
  maxPages: number, 
  delayMs: number,
  keywords: string[],
  result: ScrapingResult,
  processedUrls: Set<string>,
  processedTitles: Set<string>
): Promise<void> {
  let currentPage = 1;

  while (currentPage <= maxPages) {
    try {
      const pageUrl = currentPage === 1 ? baseUrl : `${baseUrl}page/${currentPage}/`;
      console.log(`Scraping Kalbar Online page ${currentPage}: ${pageUrl}`);

      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Wait for page content to load
      await page.waitForLoadState('domcontentloaded');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for dynamic content
      
      // Extract article links and titles for Kalbar Online
      const articles = await page.evaluate(() => {
        const articles = [];
        
        // Try different selectors specific to Kalbar Online structure
        const selectors = [
          // Main article containers
          'article',
          '.post',
          '.entry',
          '.news-item',
          '.item-list',
          '.content-item',
          // Specific to WordPress themes commonly used
          '.post-item',
          '.entry-item',
          'div[class*="post"]',
          'div[class*="entry"]'
        ];
        
        let articleElements: NodeListOf<Element> | null = null;
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            articleElements = elements;
            console.log(`Found ${elements.length} articles using selector: ${selector}`);
            break;
          }
        }
        
        // If still no articles found, try direct link approach
        if (!articleElements || articleElements.length === 0) {
          const linkSelectors = [
            'h2 a[href*="/"]',
            'h3 a[href*="/"]', 
            'h4 a[href*="/"]',
            '.entry-title a',
            '.post-title a',
            'a[href*="/"][href*="20"]', // Links with year
            'a[href*="/berita"]',
            'a[title]'
          ];
          
          for (const linkSelector of linkSelectors) {
            const linkElements = document.querySelectorAll(linkSelector);
            if (linkElements.length > 0) {
              console.log(`Found ${linkElements.length} article links using selector: ${linkSelector}`);
              
              linkElements.forEach(linkEl => {
                const title = linkEl.textContent?.trim() || linkEl.getAttribute('title')?.trim();
                const href = linkEl.getAttribute('href');
                
                if (title && href && title.length > 10) {
                  articles.push({
                    title,
                    link: href.startsWith('http') ? href : 'https://kalbaronline.com' + href,
                  });
                }
              });
              break;
            }
          }
        } else {
          // Process article containers
          for (const element of articleElements) {
            let titleElement, linkElement;
            
            // Look for title in various places within the article container
            const titleSelectors = [
              '.entry-title a',
              '.post-title a', 
              'h1 a',
              'h2 a',
              'h3 a',
              'h4 a',
              '.title a',
              '.headline a',
              'a[href*="/"]'
            ];
            
            for (const titleSelector of titleSelectors) {
              titleElement = element.querySelector(titleSelector);
              if (titleElement) {
                linkElement = titleElement;
                break;
              }
            }
            
            // Fallback: find any link in the container
            if (!titleElement) {
              linkElement = element.querySelector('a[href*="/"]');
              titleElement = linkElement;
            }
            
            if (titleElement && linkElement) {
              const title = titleElement.textContent?.trim() || titleElement.getAttribute('title')?.trim();
              const href = linkElement.getAttribute('href');
              
              if (title && href && title.length > 10) {
                articles.push({
                  title,
                  link: href.startsWith('http') ? href : 'https://kalbaronline.com' + href,
                });
              }
            }
          }
        }

        return articles;
      });

      console.log(`Found ${articles.length} articles on Kalbar Online page ${currentPage}`);
      
      // Filter articles by keywords in title
      const relevantArticles = articles.filter(article => 
        keywords.some(keyword => 
          article.title.toLowerCase().includes(keyword)
        )
      );

      console.log(`Found ${relevantArticles.length} relevant articles (containing keywords)`);
      
      // If no articles found at all, might be end of content or blocked
      if (articles.length === 0) {
        console.log(`No articles found on page ${currentPage}, stopping pagination`);
        break;
      }
      
      // Enhanced logging for pagination continuation
      if (relevantArticles.length === 0) {
        console.log(`No relevant articles found on Kalbar Online page ${currentPage}, but continuing to next page...`);
      } else {
        console.log(`Processing ${relevantArticles.length} relevant articles from Kalbar Online page ${currentPage}...`);
      }

      // Scrape content from relevant articles
      for (const article of relevantArticles) {
        try {
          await page.goto(article.link, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await new Promise(resolve => setTimeout(resolve, delayMs)); // Rate limiting

          // Extract article content from Kalbar Online
          const articleData = await page.evaluate(({ articleTitle, articleLink }) => {
            // Content selectors specific for Kalbar Online
            const contentSelectors = [
              '.entry-content',
              '.post-content', 
              '.article-content',
              '.content',
              'article .content',
              '.post-body',
              '.main-content',
              '.text-content',
              '.story-content',
              
              // Generic selectors
              'article p',
              '.content p',
              'main p',
              'p'
            ];

            let content = '';
            
            for (const selector of contentSelectors) {
              const contentElement = document.querySelector(selector);
              if (contentElement) {
                let tempContent = '';
                
                // If selector targets paragraphs, collect all paragraph text
                if (selector.includes('p')) {
                  const paragraphs = document.querySelectorAll(selector);
                  tempContent = Array.from(paragraphs)
                    .map(p => {
                      // Remove any style attributes and unwanted elements
                      const pClone = p.cloneNode(true) as Element;
                      pClone.querySelectorAll('style, script, noscript').forEach(el => el.remove());
                      pClone.removeAttribute('style');
                      return pClone.textContent?.trim();
                    })
                    .filter(text => text && text.length > 20) // Filter out short paragraphs
                    .join(' ');
                } else {
                  // Clone the element and clean it
                  const contentClone = contentElement.cloneNode(true) as Element;
                  contentClone.querySelectorAll('style, script, noscript, .advertisement, .ads, .social').forEach(el => el.remove());
                  contentClone.removeAttribute('style');
                  tempContent = contentClone.textContent?.trim() || '';
                }
                
                if (tempContent.length > 100) { // Use the selector that gives substantial content
                  content = tempContent;
                  break;
                }
              }
            }

            // Try to extract date - Enhanced selectors for Kalbar Online
            const dateSelectors = [
              // Common WordPress date selectors  
              '.post-date',
              '.published-date',
              '.entry-date',
              '.date',
              'time',
              '.meta-date',
              '[datetime]',
              // Kalbar Online specific selectors
              '.post-meta .date',
              '.entry-meta .date',
              '.article-meta .date',
              '.meta-info .date',
              '.post-meta time',
              '.entry-meta time',
              '.article-meta time',
              '.post-info time',
              // More generic selectors
              '.meta time',
              '.byline time',
              '.post-info .date',
              '.article-info .date',
              '.meta-data',
              '.post-details',
              '.article-details',
              // Author and date info
              '.author-date',
              '.post-author-date',
              '.entry-author-date'
            ];

            let dateString = '';
            for (const selector of dateSelectors) {
              const dateElement = document.querySelector(selector);
              if (dateElement) {
                // Try multiple ways to get date text
                dateString = dateElement.getAttribute('datetime') || 
                           dateElement.getAttribute('content') ||
                           dateElement.textContent?.trim() || '';
                           
                if (dateString && dateString.length > 5) { // Must be substantial
                  console.log(`Found date using selector "${selector}": ${dateString}`);
                  break;
                }
              }
            }
            
            // If no date found with specific selectors, try broader search for Kalbar Online
            if (!dateString) {
              const broadSelectors = [
                'meta[property="article:published_time"]',
                'meta[name="DC.date.issued"]',
                'meta[name="date"]',
                'meta[itemprop="datePublished"]',
                '[itemprop="datePublished"]',
                'meta[property="og:updated_time"]',
                'meta[name="article:published_time"]'
              ];
              
              for (const selector of broadSelectors) {
                const metaElement = document.querySelector(selector);
                if (metaElement) {
                  dateString = metaElement.getAttribute('content') ||
                             metaElement.getAttribute('datetime') ||
                             metaElement.textContent?.trim() || '';
                  if (dateString) {
                    console.log(`Found date using meta selector "${selector}": ${dateString}`);
                    break;
                  }
                }
              }
            }

            return {
              title: articleTitle,
              content: content || 'Content could not be extracted',
              link: articleLink,
              dateString,
            };
          }, { articleTitle: article.title, articleLink: article.link });

          // Parse date using enhanced Indonesian date parser
          let articleDate: Date;
          if (articleData.dateString) {
            console.log(`\n🔍 Processing article: "${articleData.title.substring(0, 60)}..."`);
            console.log(`📅 Raw date string found: "${articleData.dateString}"`);
            articleDate = parseIndonesianDate(articleData.dateString);
            const wasCurrentDate = Math.abs(articleDate.getTime() - new Date().getTime()) < 24 * 60 * 60 * 1000; // Within 24 hours
            if (wasCurrentDate) {
              console.log(`⚠️  WARNING: Date parsing may have failed - using current date (${articleDate.toISOString().split('T')[0]})`);
            } else {
              console.log(`✅ Successfully parsed date: ${articleDate.toISOString().split('T')[0]} (${articleDate.toLocaleDateString('id-ID')})`);
            }
          } else {
            articleDate = new Date();
            console.log(`\n❌ NO DATE FOUND for "${articleData.title.substring(0, 60)}..."`);
            console.log(`Using current date as fallback: ${articleDate.toISOString().split('T')[0]}`);
          }

          // Find matched keywords
          const matchedKeywords = keywords.filter(keyword => 
            articleData.title.toLowerCase().includes(keyword) || 
            articleData.content.toLowerCase().includes(keyword)
          );

          if (matchedKeywords.length > 0) {
            // Check for duplicates before processing
            const isDuplicate = await checkDuplicateArticle(
              articleData.title, 
              articleData.link, 
              processedUrls, 
              processedTitles
            );
            
            if (isDuplicate) {
              result.duplicates++;
              console.log(`⚠ Skipping duplicate from Kalbar Online: ${articleData.title.substring(0, 50)}...`);
              continue;
            }
            
            // Add to processed sets
            processedUrls.add(articleData.link.toLowerCase());
            processedTitles.add(articleData.title.toLowerCase().trim());

            const scrapedItem: ScrapedNewsItem = {
              title: articleData.title,
              content: cleanContent(articleData.content),
              link: articleData.link,
              date: articleDate,
              portal: 'kalbaronline.com',
              matchedKeywords,
            };

            // Generate unique ID for the news
            const idBerita = `ko_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Try to save to database
            try {
              await saveScrapedArticle({
                idBerita,
                portalBerita: scrapedItem.portal,
                linkBerita: scrapedItem.link,
                judul: scrapedItem.title,
                isi: scrapedItem.content,
                tanggalBerita: scrapedItem.date,
                matchedKeywords: scrapedItem.matchedKeywords,
              });

              // Update keyword match counts
              await incrementKeywordMatchCount(scrapedItem.matchedKeywords);

              result.newItems++;
              result.scrapedItems.push(scrapedItem);
              console.log(`✓ Saved from Kalbar Online: ${scrapedItem.title.substring(0, 50)}...`);

            } catch (dbError: unknown) {
              if ((dbError as { code?: string }).code === 'P2002') {
                result.duplicates++;
                console.log(`⚠ Duplicate from Kalbar Online: ${scrapedItem.title.substring(0, 50)}...`);
              } else {
                const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
                result.errors.push(`Database error: ${errorMessage}`);
                console.error('Database error:', dbError);
              }
            }

            result.totalScraped++;
          }

        } catch (articleError: unknown) {
          const errorMessage = articleError instanceof Error ? articleError.message : 'Unknown article error';
          console.error(`Error scraping Kalbar Online article ${article.link}:`, errorMessage);
          result.errors.push(`Article error: ${errorMessage}`);
        }
      }

      // Check if we should continue to next page - Kalbar Online pagination
      const hasNextPage = await page.evaluate(() => {
        const nextButton = document.querySelector('.next, .next-page, a[href*="page/"]:last-child, .pagination .next');
        return nextButton && !nextButton.classList.contains('disabled');
      });

      if (!hasNextPage) {
        console.log('No more pages found on Kalbar Online, stopping pagination');
        break;
      }

      currentPage++;
      await new Promise(resolve => setTimeout(resolve, delayMs)); // Rate limiting between pages

    } catch (pageError: unknown) {
      const errorMessage = pageError instanceof Error ? pageError.message : 'Unknown page error';
      console.error(`Error scraping Kalbar Online page ${currentPage}:`, errorMessage);
      result.errors.push(`Page ${currentPage} error: ${errorMessage}`);
      break; // Stop pagination on page error
    }
  }
}

async function scrapeAntaraNews(
  page: Page, 
  baseUrl: string, 
  maxPages: number, 
  delayMs: number,
  keywords: string[],
  result: ScrapingResult,
  processedUrls: Set<string>,
  processedTitles: Set<string>
): Promise<void> {
  let currentPage = 1;

  while (currentPage <= maxPages) {
    try {
      const pageUrl = currentPage === 1 ? baseUrl : `${baseUrl}/${currentPage}`;
      console.log(`Scraping Antara News page ${currentPage}: ${pageUrl}`);

      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Wait for page content to load
      await page.waitForLoadState('domcontentloaded');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for dynamic content
      
      // Extract article links and titles for Antara News
      const articles = await page.evaluate(() => {
        const articles = [];
        
        // Try different selectors for Antara News
        const selectors = [
          // Main article containers
          'article',
          '.berita',
          '.news-item',
          '.post',
          '.entry',
          '.item',
          // Links to articles
          'a[href*="/berita/"]',
          'a[href*="/news/"]',
          // General containers
          'div[class*="item"]',
          'div[class*="post"]',
          'div[class*="article"]'
        ];
        
        let articleElements: NodeListOf<Element> | null = null;
        
        // First try to find article containers
        for (const selector of selectors) {
          if (selector.startsWith('a[')) continue; // Skip link selectors for now
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            articleElements = elements;
            console.log(`Found ${elements.length} articles using selector: ${selector}`);
            break;
          }
        }
        
        if (articleElements && articleElements.length > 0) {
          // Process article containers
          for (const element of articleElements) {
            let titleElement, linkElement;
            
            // Look for title and link within each container
            const titleSelectors = [
              'h1 a', 'h2 a', 'h3 a', 'h4 a',
              '.title a', '.headline a',
              'a[href*="/berita/"]',
              'a[href*="/news/"]',
              'a[title]'
            ];
            
            for (const titleSelector of titleSelectors) {
              titleElement = element.querySelector(titleSelector);
              if (titleElement) {
                linkElement = titleElement;
                break;
              }
            }
            
            if (titleElement && linkElement) {
              const title = titleElement.textContent?.trim() || titleElement.getAttribute('title')?.trim();
              const href = linkElement.getAttribute('href');
              
              if (title && href && title.length > 10) {
                articles.push({
                  title,
                  link: href.startsWith('http') ? href : 'https://kalbar.antaranews.com' + href,
                });
              }
            }
          }
        }
        
        // If no articles found using containers, try direct link approach
        if (articles.length === 0) {
          const linkSelectors = [
            'a[href*="/berita/"]',
            'a[href*="/news/"]',
            'h2 a', 'h3 a', 'h4 a',
            'a[title]'
          ];
          
          for (const linkSelector of linkSelectors) {
            const linkElements = document.querySelectorAll(linkSelector);
            if (linkElements.length > 0) {
              console.log(`Found ${linkElements.length} article links using selector: ${linkSelector}`);
              
              linkElements.forEach(linkEl => {
                const title = linkEl.textContent?.trim() || linkEl.getAttribute('title')?.trim();
                const href = linkEl.getAttribute('href');
                
                if (title && href && title.length > 10 && href.includes('/berita/')) {
                  articles.push({
                    title,
                    link: href.startsWith('http') ? href : 'https://kalbar.antaranews.com' + href,
                  });
                }
              });
              break;
            }
          }
        }

        return articles;
      });

      console.log(`Found ${articles.length} articles on Antara News page ${currentPage}`);
      
      // Filter articles by keywords in title
      const relevantArticles = articles.filter(article => 
        keywords.some(keyword => 
          article.title.toLowerCase().includes(keyword)
        )
      );

      console.log(`Found ${relevantArticles.length} relevant articles (containing keywords)`);
      
      // If no articles found at all, might be end of content or blocked
      if (articles.length === 0) {
        console.log(`No articles found on page ${currentPage}, stopping pagination`);
        break;
      }
      
      // Enhanced logging for pagination continuation
      if (relevantArticles.length === 0) {
        console.log(`No relevant articles found on Antara News page ${currentPage}, but continuing to next page...`);
      } else {
        console.log(`Processing ${relevantArticles.length} relevant articles from Antara News page ${currentPage}...`);
      }

      // Scrape content from relevant articles
      for (const article of relevantArticles) {
        try {
          await page.goto(article.link, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await new Promise(resolve => setTimeout(resolve, delayMs)); // Rate limiting

          // Extract article content from Antara News
          const articleData = await page.evaluate(({ articleTitle, articleLink }) => {
            // Content selectors for Antara News
            const contentSelectors = [
              '.article-content',
              '.post-content', 
              '.entry-content',
              '.content',
              '.news-content',
              '.story-content',
              '.article-body',
              '.post-body',
              '.main-content',
              '.text-content',
              
              // Generic selectors
              'article .content',
              'main .content',
              'article p',
              '.content p',
              'main p',
              'p'
            ];

            let content = '';
            
            for (const selector of contentSelectors) {
              const contentElement = document.querySelector(selector);
              if (contentElement) {
                let tempContent = '';
                
                // If selector targets paragraphs, collect all paragraph text
                if (selector.includes('p')) {
                  const paragraphs = document.querySelectorAll(selector);
                  tempContent = Array.from(paragraphs)
                    .map(p => {
                      // Remove any style attributes and unwanted elements
                      const pClone = p.cloneNode(true) as Element;
                      pClone.querySelectorAll('style, script, noscript, .advertisement, .ads').forEach(el => el.remove());
                      pClone.removeAttribute('style');
                      return pClone.textContent?.trim();
                    })
                    .filter(text => text && text.length > 20) // Filter out short paragraphs
                    .join(' ');
                } else {
                  // Clone the element and clean it
                  const contentClone = contentElement.cloneNode(true) as Element;
                  contentClone.querySelectorAll('style, script, noscript, .advertisement, .ads, .social').forEach(el => el.remove());
                  contentClone.removeAttribute('style');
                  tempContent = contentClone.textContent?.trim() || '';
                }
                
                if (tempContent.length > 100) { // Use the selector that gives substantial content
                  content = tempContent;
                  break;
                }
              }
            }

            // Try to extract date - Enhanced selectors for Antara News
            const dateSelectors = [
              // Time elements with datetime attribute (highest priority)
              'time[datetime]',
              '[datetime]',
              // Common date selectors
              '.date',
              '.post-date',
              '.published-date',
              '.entry-date',
              '.article-date',
              '.news-date',
              'time',
              '.meta-date',
              // Meta sections
              '.post-meta', 
              '.entry-meta', 
              '.article-meta', 
              '.meta-info',
              '.post-info', 
              '.article-info', 
              '.byline',
              // JSON-LD structured data
              'script[type="application/ld+json"]'
            ];

            let dateString = '';
            
            for (const selector of dateSelectors) {
              if (selector === 'script[type="application/ld+json"]') {
                // Handle JSON-LD structured data
                const scripts = document.querySelectorAll(selector);
                for (const script of scripts) {
                  try {
                    const jsonData = JSON.parse(script.textContent || '');
                    if (jsonData.datePublished) {
                      dateString = jsonData.datePublished;
                      console.log(`Found date from JSON-LD: ${dateString}`);
                      break;
                    }
                  } catch (e) {
                    // Ignore JSON parse errors
                  }
                }
              } else {
                const dateElements = document.querySelectorAll(selector);
                for (const dateElement of dateElements) {
                  // Try multiple ways to get date text
                  const potentialDate = dateElement.getAttribute('datetime') || 
                                    dateElement.getAttribute('content') ||
                                    dateElement.textContent?.trim() || '';
                                    
                  if (potentialDate && potentialDate.length > 5) {
                    // Check if this looks like a date
                    const hasNumbers = /\d/.test(potentialDate);
                    const hasDateKeywords = /\b(20\d{2}|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(potentialDate);
                    const hasDateFormats = potentialDate.includes('-') || potentialDate.includes('/') || potentialDate.includes('T') || potentialDate.includes(',');
                    
                    if (hasNumbers && (hasDateKeywords || hasDateFormats)) {
                      dateString = potentialDate;
                      console.log(`Found date using selector "${selector}": ${dateString}`);
                      break;
                    }
                  }
                }
              }
              
              if (dateString) break;
            }
            
            // If no date found with specific selectors, try meta tags
            if (!dateString) {
              const metaSelectors = [
                'meta[property="article:published_time"]',
                'meta[property="article:modified_time"]',
                'meta[name="DC.date.issued"]',
                'meta[name="date"]',
                'meta[itemprop="datePublished"]',
                'meta[itemprop="dateModified"]'
              ];
              
              for (const selector of metaSelectors) {
                const metaElement = document.querySelector(selector);
                if (metaElement) {
                  const content = metaElement.getAttribute('content') || '';
                  if (content) {
                    dateString = content;
                    console.log(`Found date using meta selector "${selector}": ${dateString}`);
                    break;
                  }
                }
              }
            }

            return {
              title: articleTitle,
              content: content || 'Content could not be extracted',
              link: articleLink,
              dateString,
            };
          }, { articleTitle: article.title, articleLink: article.link });

          // Parse date using enhanced Indonesian date parser
          let articleDate: Date;
          if (articleData.dateString) {
            console.log(`\n🔍 Processing Antara News article: "${articleData.title.substring(0, 60)}..."`);
            console.log(`📅 Raw date string found: "${articleData.dateString}"`);
            articleDate = parseIndonesianDate(articleData.dateString);
            const wasCurrentDate = Math.abs(articleDate.getTime() - new Date().getTime()) < 24 * 60 * 60 * 1000; // Within 24 hours
            if (wasCurrentDate) {
              console.log(`⚠️  WARNING: Date parsing may have failed - using current date (${articleDate.toISOString().split('T')[0]})`);
            } else {
              console.log(`✅ Successfully parsed date: ${articleDate.toISOString().split('T')[0]} (${articleDate.toLocaleDateString('id-ID')})`);
            }
          } else {
            articleDate = new Date();
            console.log(`\n❌ NO DATE FOUND for Antara News "${articleData.title.substring(0, 60)}..."`);
            console.log(`Using current date as fallback: ${articleDate.toISOString().split('T')[0]}`);
          }

          // Find matched keywords
          const matchedKeywords = keywords.filter(keyword => 
            articleData.title.toLowerCase().includes(keyword) || 
            articleData.content.toLowerCase().includes(keyword)
          );

          if (matchedKeywords.length > 0) {
            // Check for duplicates before processing
            const isDuplicate = await checkDuplicateArticle(
              articleData.title, 
              articleData.link, 
              processedUrls, 
              processedTitles
            );
            
            if (isDuplicate) {
              result.duplicates++;
              console.log(`⚠ Skipping duplicate from Antara News: ${articleData.title.substring(0, 50)}...`);
              continue;
            }
            
            // Add to processed sets
            processedUrls.add(articleData.link.toLowerCase());
            processedTitles.add(articleData.title.toLowerCase().trim());

            const scrapedItem: ScrapedNewsItem = {
              title: articleData.title,
              content: cleanContent(articleData.content),
              link: articleData.link,
              date: articleDate,
              portal: 'kalbar.antaranews.com',
              matchedKeywords,
            };

            // Generate unique ID for the news
            const idBerita = `an_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Try to save to database
            try {
              await saveScrapedArticle({
                idBerita,
                portalBerita: scrapedItem.portal,
                linkBerita: scrapedItem.link,
                judul: scrapedItem.title,
                isi: scrapedItem.content,
                tanggalBerita: scrapedItem.date,
                matchedKeywords: scrapedItem.matchedKeywords,
              });

              // Update keyword match counts
              await incrementKeywordMatchCount(scrapedItem.matchedKeywords);

              result.newItems++;
              result.scrapedItems.push(scrapedItem);
              console.log(`✓ Saved from Antara News: ${scrapedItem.title.substring(0, 50)}...`);

            } catch (dbError: unknown) {
              if ((dbError as { code?: string }).code === 'P2002') {
                result.duplicates++;
                console.log(`⚠ Duplicate from Antara News: ${scrapedItem.title.substring(0, 50)}...`);
              } else {
                const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
                result.errors.push(`Database error: ${errorMessage}`);
                console.error('Database error:', dbError);
              }
            }

            result.totalScraped++;
          }

        } catch (articleError: unknown) {
          const errorMessage = articleError instanceof Error ? articleError.message : 'Unknown article error';
          console.error(`Error scraping Antara News article ${article.link}:`, errorMessage);
          result.errors.push(`Article error: ${errorMessage}`);
        }
      }

      // Check if we should continue to next page - Antara News pagination
      const hasNextPage = await page.evaluate((currentPage) => {
        const nextButton = document.querySelector('.next, .next-page, a[href*="/' + (currentPage + 1) + '"], .pagination .next');
        return nextButton && !nextButton.classList.contains('disabled');
      }, currentPage);

      if (!hasNextPage) {
        console.log('No more pages found on Antara News, stopping pagination');
        break;
      }

      currentPage++;
      await new Promise(resolve => setTimeout(resolve, delayMs)); // Rate limiting between pages

    } catch (pageError: unknown) {
      const errorMessage = pageError instanceof Error ? pageError.message : 'Unknown page error';
      console.error(`Error scraping Antara News page ${currentPage}:`, errorMessage);
      result.errors.push(`Page ${currentPage} error: ${errorMessage}`);
      break; // Stop pagination on page error
    }
  }
}

async function scrapeSuaraKalbar(
  page: Page, 
  baseUrl: string, 
  maxPages: number, 
  delayMs: number,
  keywords: string[],
  result: ScrapingResult,
  processedUrls: Set<string>,
  processedTitles: Set<string>
): Promise<void> {
  let currentPage = 1;

  while (currentPage <= maxPages) {
    try {
      const pageUrl = currentPage === 1 ? baseUrl : `${baseUrl}page/${currentPage}/`;
      console.log(`Scraping Suara Kalbar page ${currentPage}: ${pageUrl}`);

      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Wait for page content to load - extended for Suara Kalbar
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle');
      
      // Wait longer for dynamic content
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      // Try multiple approaches to wait for pagination
      let paginationLoaded = false;
      const paginationSelectors = [
        '.ray-posts-pagination',
        'section[class*="pagination"]',
        'a[href*="/page/"]',
        '*:contains("Selanjutnya")',
        'section'
      ];
      
      for (const selector of paginationSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          console.log(`[SUARA KALBAR] ✅ Found element with selector: ${selector}`);
          paginationLoaded = true;
          break;
        } catch (e) {
          console.log(`[SUARA KALBAR] ⚠️ Selector "${selector}" not found, trying next...`);
        }
      }
      
      if (!paginationLoaded) {
        console.log(`[SUARA KALBAR] ⚠️ No specific pagination elements found, but continuing...`);
      }
      
      // Additional wait for any remaining JavaScript
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Extract article links and titles for Suara Kalbar
      const articles = await page.evaluate(() => {
        const articles = [];
        
        // Try Suara Kalbar specific selectors first
        const selectors = [
          // Main WordPress article containers
          '.ray-main-post-title a',
          'article h2 a',
          'article h3 a',
          '.entry-title a',
          '.post-title a',
          // Fallback generic selectors
          'article a[href*="/202"]', // Links with year in URL
          'h2 a[href*="/"]',
          'h3 a[href*="/"]',
          'a[href*="/category/kalbar/"]'
        ];
        
        let articleElements: NodeListOf<Element> | null = null;
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`[SUARA KALBAR] Found ${elements.length} articles using selector: ${selector}`);
            
            elements.forEach(element => {
              const title = element.textContent?.trim() || element.getAttribute('title')?.trim();
              const href = element.getAttribute('href');
              
              if (title && href && title.length > 10) {
                // Ensure full URL
                const fullUrl = href.startsWith('http') ? href : 
                               href.startsWith('/') ? 'https://www.suarakalbar.co.id' + href : 
                               'https://www.suarakalbar.co.id/' + href;
                
                // Only include articles from the kalbar category or recent articles
                if (fullUrl.includes('/category/kalbar/') || 
                    fullUrl.match(/\/202[0-9]\/\d{2}\//)) {
                  articles.push({
                    title,
                    link: fullUrl,
                  });
                }
              }
            });
            
            if (articles.length > 0) {
              break; // Found articles with this selector
            }
          }
        }
        
        // Remove duplicates by URL
        const uniqueArticles = articles.filter((article, index, self) => 
          index === self.findIndex(a => a.link === article.link)
        );
        
        console.log(`[SUARA KALBAR] Total unique articles found: ${uniqueArticles.length}`);
        return uniqueArticles;
      });

      console.log(`Found ${articles.length} articles on Suara Kalbar page ${currentPage}`);
      
      // Filter articles by keywords in title
      const relevantArticles = articles.filter(article => 
        keywords.some(keyword => 
          article.title.toLowerCase().includes(keyword)
        )
      );

      console.log(`Found ${relevantArticles.length} relevant articles (containing keywords)`);
      
      // If no articles found at all, might be end of content
      if (articles.length === 0) {
        console.log(`No articles found on page ${currentPage}, stopping pagination`);
        break;
      }
      
      // Log relevant articles for debugging
      if (relevantArticles.length === 0) {
        console.log(`No relevant articles found on Suara Kalbar page ${currentPage}, but continuing to next page...`);
        console.log(`Total articles found: ${articles.length}, Keywords: [${keywords.join(', ')}]`);
      } else {
        console.log(`Processing ${relevantArticles.length} relevant articles from Suara Kalbar page ${currentPage}...`);
        console.log(`Relevant articles (first 3):`);
        relevantArticles.slice(0, 3).forEach((article, index) => {
          const matchedKws = keywords.filter(kw => article.title.toLowerCase().includes(kw));
          console.log(`  ${index + 1}. "${article.title.substring(0, 50)}..." [Keywords: ${matchedKws.join(', ')}]`);
        });
      }

      // Scrape content from relevant articles
      for (const article of relevantArticles) {
        try {
          await page.goto(article.link, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await new Promise(resolve => setTimeout(resolve, delayMs)); // Rate limiting

          // Extract article content from Suara Kalbar
          const articleData = await page.evaluate(({ articleTitle, articleLink }) => {
            // Content selectors for Suara Kalbar (WordPress-based)
            const contentSelectors = [
              '.entry-content',
              '.post-content',
              '.article-content',
              '.content',
              'article .content',
              '.post-body',
              '.article-body',
              '.main-content',
              '.wp-block-group',
              
              // WordPress block editor content
              '.wp-block-paragraph',
              
              // Generic selectors
              'article p',
              '.content p',
              'main p',
              'p'
            ];

            let content = '';
            let usedSelector = '';
            
            for (const selector of contentSelectors) {
              const contentElement = document.querySelector(selector);
              if (contentElement) {
                let tempContent = '';
                
                // If selector targets paragraphs, collect all paragraph text
                if (selector.includes('p')) {
                  const paragraphs = document.querySelectorAll(selector);
                  tempContent = Array.from(paragraphs)
                    .map(p => {
                      // Clean paragraphs
                      const pClone = p.cloneNode(true) as Element;
                      pClone.querySelectorAll('style, script, noscript, .advertisement, .ads, .social').forEach(el => el.remove());
                      pClone.removeAttribute('style');
                      return pClone.textContent?.trim();
                    })
                    .filter(text => text && text.length > 20) // Filter out short paragraphs
                    .join(' ');
                } else {
                  // Clean the element
                  const contentClone = contentElement.cloneNode(true) as Element;
                  contentClone.querySelectorAll('style, script, noscript, .advertisement, .ads, .social, .wp-block-buttons').forEach(el => el.remove());
                  contentClone.removeAttribute('style');
                  tempContent = contentClone.textContent?.trim() || '';
                }
                
                if (tempContent.length > 100) {
                  content = tempContent;
                  usedSelector = selector;
                  break;
                }
              }
            }
            
            console.log(`[SUARA KALBAR] Content extracted using selector: ${usedSelector}, length: ${content.length}`);

            // Try to extract date for Suara Kalbar
            const dateSelectors = [
              // WordPress common selectors
              'time[datetime]',
              '[datetime]',
              '.post-date',
              '.published-date',
              '.entry-date',
              '.date',
              'time',
              '.meta-date',
              
              // WordPress meta sections
              '.post-meta time',
              '.entry-meta time',
              '.entry-meta .date',
              '.post-meta .date',
              '.article-meta .date',
              '.wp-block-post-date',
              
              // Author and date info
              '.byline',
              '.post-info',
              '.article-info',
              '.meta-info'
            ];

            let dateString = '';
            let foundSelector = '';
            
            for (const selector of dateSelectors) {
              const dateElements = document.querySelectorAll(selector);
              for (const dateElement of dateElements) {
                const potentialDate = dateElement.getAttribute('datetime') || 
                                  dateElement.getAttribute('content') ||
                                  dateElement.textContent?.trim() || '';
                                  
                if (potentialDate && potentialDate.length > 5) {
                  // Basic validation for dates
                  const hasNumbers = /\d/.test(potentialDate);
                  const hasDateKeywords = /\b(20\d{2}|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(potentialDate);
                  const hasDateFormats = potentialDate.includes('-') || potentialDate.includes('/') || potentialDate.includes('T') || potentialDate.includes(',');
                  
                  if (hasNumbers && (hasDateKeywords || hasDateFormats)) {
                    dateString = potentialDate;
                    foundSelector = selector;
                    console.log(`[SUARA KALBAR] Found date using selector "${selector}": ${dateString}`);
                    break;
                  }
                }
              }
              if (dateString) break;
            }
            
            // If no date found, try meta tags
            if (!dateString) {
              const metaSelectors = [
                'meta[property="article:published_time"]',
                'meta[property="article:modified_time"]',
                'meta[name="DC.date.issued"]',
                'meta[name="date"]',
                'meta[itemprop="datePublished"]',
                'meta[itemprop="dateModified"]'
              ];
              
              for (const selector of metaSelectors) {
                const metaElement = document.querySelector(selector);
                if (metaElement) {
                  const content = metaElement.getAttribute('content') || '';
                  if (content) {
                    dateString = content;
                    foundSelector = selector;
                    console.log(`[SUARA KALBAR] Found date using meta selector "${selector}": ${dateString}`);
                    break;
                  }
                }
              }
            }

            return {
              title: articleTitle,
              content: content || 'Content could not be extracted',
              link: articleLink,
              dateString,
            };
          }, { articleTitle: article.title, articleLink: article.link });

          // Parse date using enhanced Indonesian date parser
          let articleDate: Date;
          if (articleData.dateString) {
            console.log(`\n🔍 [SUARA KALBAR] Processing article: "${articleData.title.substring(0, 60)}..."`);
            console.log(`📅 Raw date string found: "${articleData.dateString}"`);
            articleDate = parseIndonesianDate(articleData.dateString);
            
            const wasCurrentDate = Math.abs(articleDate.getTime() - new Date().getTime()) < 24 * 60 * 60 * 1000;
            if (wasCurrentDate) {
              console.log(`⚠️  WARNING: Date parsing may have failed - using current date (${articleDate.toISOString().split('T')[0]})`);
            } else {
              console.log(`✅ Successfully parsed date: ${articleDate.toISOString().split('T')[0]} (${articleDate.toLocaleDateString('id-ID')})`);
            }
          } else {
            articleDate = new Date();
            console.log(`\n❌ [SUARA KALBAR] NO DATE FOUND for "${articleData.title.substring(0, 60)}..."`);
            console.log(`Using current date as fallback: ${articleDate.toISOString().split('T')[0]}`);
          }

          // Find matched keywords
          const matchedKeywords = keywords.filter(keyword => 
            articleData.title.toLowerCase().includes(keyword) || 
            articleData.content.toLowerCase().includes(keyword)
          );

          if (matchedKeywords.length > 0) {
            // Check for duplicates before processing
            const isDuplicate = await checkDuplicateArticle(
              articleData.title, 
              articleData.link, 
              processedUrls, 
              processedTitles
            );
            
            if (isDuplicate) {
              result.duplicates++;
              console.log(`⚠ [SUARA KALBAR] Skipping duplicate: ${articleData.title.substring(0, 50)}...`);
              continue;
            }
            
            // Add to processed sets
            processedUrls.add(articleData.link.toLowerCase());
            processedTitles.add(articleData.title.toLowerCase().trim());

            const scrapedItem: ScrapedNewsItem = {
              title: articleData.title,
              content: cleanContent(articleData.content),
              link: articleData.link,
              date: articleDate,
              portal: 'suarakalbar.co.id',
              matchedKeywords,
            };

            // Generate unique ID for the news
            const idBerita = `sk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Try to save to database
            try {
              await saveScrapedArticle({
                idBerita,
                portalBerita: scrapedItem.portal,
                linkBerita: scrapedItem.link,
                judul: scrapedItem.title,
                isi: scrapedItem.content,
                tanggalBerita: scrapedItem.date,
                matchedKeywords: scrapedItem.matchedKeywords,
              });

              // Update keyword match counts
              await incrementKeywordMatchCount(scrapedItem.matchedKeywords);

              result.newItems++;
              result.scrapedItems.push(scrapedItem);
              console.log(`✓ [SUARA KALBAR] SAVED: ${scrapedItem.title.substring(0, 50)}...`);
              console.log(`  📅 Date: ${scrapedItem.date.toISOString().split('T')[0]}`);
              console.log(`  🏷️  Keywords: [${scrapedItem.matchedKeywords.join(', ')}]`);

            } catch (dbError: unknown) {
              if ((dbError as { code?: string }).code === 'P2002') {
                result.duplicates++;
                console.log(`⚠ [SUARA KALBAR] Duplicate: ${scrapedItem.title.substring(0, 50)}...`);
              } else {
                const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
                result.errors.push(`Database error: ${errorMessage}`);
                console.error('Database error:', dbError);
              }
            }

            result.totalScraped++;
          }

        } catch (articleError: unknown) {
          const errorMessage = articleError instanceof Error ? articleError.message : 'Unknown article error';
          console.error(`Error scraping Suara Kalbar article ${article.link}:`, errorMessage);
          result.errors.push(`Article error: ${errorMessage}`);
        }
      }

      // Check if we should continue to next page - Suara Kalbar pagination
      console.log(`[SUARA KALBAR] === STARTING PAGINATION CHECK ===`);
      console.log(`[SUARA KALBAR] Current page: ${currentPage}, Max pages: ${maxPages}`);
      
      // Simple check first: if we haven't reached maxPages, try to continue
      if (currentPage >= maxPages) {
        console.log(`[SUARA KALBAR] ❌ Reached maxPages limit: ${currentPage}/${maxPages}`);
        break;
      }
      
      const hasNextPage = await page.evaluate((currentPage) => {
        console.log(`[SUARA KALBAR] === PAGINATION DEBUG FOR PAGE ${currentPage} ===`);
        
        // Debug: Show all elements that might be pagination
        const allLinks = document.querySelectorAll('a');
        console.log(`[SUARA KALBAR] Total links found: ${allLinks.length}`);
        
        // Look for any elements with "ray" class
        const rayElements = document.querySelectorAll('[class*="ray"]');
        console.log(`[SUARA KALBAR] Elements with "ray" class: ${rayElements.length}`);
        rayElements.forEach((el, idx) => {
          if (idx < 5) { // Log first 5 only
            console.log(`  ${idx + 1}. ${el.tagName}.${el.className} - Text: "${el.textContent?.trim().substring(0, 50)}"`);
          }
        });
        
        // Look for pagination section
        const rayPaginationSection = document.querySelector('.ray-posts-pagination');
        if (rayPaginationSection) {
          console.log(`[SUARA KALBAR] Found pagination section:`, rayPaginationSection.outerHTML);
        } else {
          console.log(`[SUARA KALBAR] ❌ No .ray-posts-pagination found`);
        }
        
        // Look for "Selanjutnya" text in any element
        let selanjutnyaFound = false;
        allLinks.forEach((link, idx) => {
          const linkText = link.textContent?.trim() || '';
          const href = link.getAttribute('href') || '';
          
          if (linkText.toLowerCase().includes('selanjutnya')) {
            console.log(`[SUARA KALBAR] 🎯 FOUND "Selanjutnya" link #${idx}: "${linkText}" -> ${href}`);
            console.log(`[SUARA KALBAR] Link classes: "${link.className}"`);
            console.log(`[SUARA KALBAR] Parent element: ${link.parentElement?.tagName}.${link.parentElement?.className}`);
            selanjutnyaFound = true;
          }
          
          // Also check for /page/ URLs
          if (href.includes('/page/') && href.includes(`/${currentPage + 1}/`)) {
            console.log(`[SUARA KALBAR] 🎯 FOUND next page URL #${idx}: "${linkText}" -> ${href}`);
            selanjutnyaFound = true;
          }
        });
        
        if (!selanjutnyaFound) {
          console.log(`[SUARA KALBAR] ❌ No "Selanjutnya" or next page URL found`);
          
          // Debug: show any links with "page" in text or href
          console.log(`[SUARA KALBAR] Links with "page" in text or href:`);
          allLinks.forEach((link, idx) => {
            const linkText = link.textContent?.trim() || '';
            const href = link.getAttribute('href') || '';
            
            if (linkText.toLowerCase().includes('page') || href.includes('/page/')) {
              console.log(`  ${idx + 1}. "${linkText}" -> ${href}`);
            }
          });
        }
        
        // Simplified approach: just look for any next page link
        console.log(`[SUARA KALBAR] 🔍 Looking for next page links...`);
        
        // Method 1: Look for "Selanjutnya" text
        let foundNextPage = false;
        let nextPageUrl = '';
        
        for (const link of allLinks) {
          const text = link.textContent?.trim().toLowerCase() || '';
          const href = link.getAttribute('href') || '';
          
          // Debug each link that might be relevant
          if (text.includes('selanjutnya') || href.includes('/page/')) {
            console.log(`[SUARA KALBAR] 🔍 Checking link: "${text}" -> ${href}`);
          }
          
          // Check for "Selanjutnya" text
          if (text.includes('selanjutnya') && href.includes('/page/')) {
            console.log(`[SUARA KALBAR] ✅ FOUND "Selanjutnya" link: ${href}`);
            foundNextPage = true;
            nextPageUrl = href;
            break;
          }
          
          // Check for next page URL pattern
          if (href.includes(`/page/${currentPage + 1}/`)) {
            console.log(`[SUARA KALBAR] ✅ FOUND next page URL: ${href}`);
            foundNextPage = true;
            nextPageUrl = href;
            break;
          }
        }
        
        if (foundNextPage) {
          console.log(`[SUARA KALBAR] ✅ NEXT PAGE CONFIRMED: ${nextPageUrl}`);
          return true;
        }
        
        // Last resort: simple fallback based on articles found
        console.log(`[SUARA KALBAR] 🤔 No pagination detected, checking fallback conditions...`);
        
        // Get article count on current page for intelligent fallback
        const currentPageArticles = document.querySelectorAll('.ray-main-post-title a, article a, h2 a, h3 a').length;
        console.log(`[SUARA KALBAR] Articles found on page ${currentPage}: ${currentPageArticles}`);
        
        // Simple fallback: if we found articles, assume more pages exist
        // (maxPages limit is already checked outside this function)
        if (currentPageArticles >= 5) {
          console.log(`[SUARA KALBAR] 🔄 SIMPLE FALLBACK: Found ${currentPageArticles} articles, assuming more pages exist`);
          return true;
        } else {
          console.log(`[SUARA KALBAR] 🛑 FALLBACK DECLINED: Only ${currentPageArticles} articles found`);
        }
        
        console.log(`[SUARA KALBAR] ❌ NO NEXT PAGE FOUND - STOPPING`);
        console.log(`[SUARA KALBAR] === END PAGINATION DEBUG ===`);
        return false;
      }, currentPage);

      if (!hasNextPage) {
        console.log('No more pages found on Suara Kalbar, stopping pagination');
        break;
      }

      // Summary for this page
      console.log(`\n=== SUARA KALBAR PAGE ${currentPage} SUMMARY ===`);
      console.log(`Total articles found: ${articles.length}`);
      console.log(`Relevant articles (with keywords): ${relevantArticles.length}`);
      console.log(`Articles processed in this page: ${relevantArticles.length}`);
      console.log(`Running total - New items: ${result.newItems}, Duplicates: ${result.duplicates}`);
      console.log(`=== END PAGE SUMMARY ===\n`);

      currentPage++;
      await new Promise(resolve => setTimeout(resolve, delayMs)); // Rate limiting between pages

    } catch (pageError: unknown) {
      const errorMessage = pageError instanceof Error ? pageError.message : 'Unknown page error';
      console.error(`❌ Error scraping Suara Kalbar page ${currentPage}:`, errorMessage);
      result.errors.push(`Page ${currentPage} error: ${errorMessage}`);
      break; // Stop pagination on page error
    }
  }
  
  // Final summary for Suara Kalbar scraping
  console.log(`\n🎯 === SUARA KALBAR SCRAPING COMPLETE ===`);
  console.log(`📄 Pages scraped: ${currentPage - 1}`);
  console.log(`📰 New articles saved: ${result.newItems}`);
  console.log(`🔄 Duplicates skipped: ${result.duplicates}`);
  console.log(`❌ Errors encountered: ${result.errors.length}`);
  console.log(`=== END SUARA KALBAR SCRAPING ===\n`);
}