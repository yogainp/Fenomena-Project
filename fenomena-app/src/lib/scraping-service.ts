import { chromium, Browser, Page } from 'playwright';
import { prisma } from './prisma';

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
    const activeKeywords = await prisma.scrappingKeyword.findMany({
      where: { isActive: true },
      select: { keyword: true },
    });

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

    // Scrape based on portal type
    if (portalUrl.includes('pontianakpost.jawapos.com')) {
      await scrapePontianakPost(page, portalUrl, maxPages, delayMs, keywordList, result);
    } else if (portalUrl.includes('kalbaronline.com')) {
      await scrapeKalbarOnline(page, portalUrl, maxPages, delayMs, keywordList, result);
    } else {
      throw new Error('Unsupported portal. Currently only supports pontianakpost.jawapos.com and kalbaronline.com');
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
  result: ScrapingResult
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

      // Extract article links and titles
      const articles = await page.evaluate(() => {
        let articleElements = document.querySelectorAll('article, .post, .news-item, .card, .entry, div[class*="post"], div[class*="article"], div[class*="news"], div[class*="item"]');
        
        // If no specific containers found, try to find any links that look like articles
        if (articleElements.length === 0) {
          // Try different approaches to find article links
          const linkSelectors = [
            'a[href*="/"][href*="20"]', // Links with year in them (likely news)
            'a[href*="/"][title]', // Links with title attribute
            'a[href*="/artikel"]', // Links with "artikel" in URL
            'a[href*="/berita"]', // Links with "berita" in URL
            'a[href*="/news"]' // Links with "news" in URL
          ];
          
          for (const selector of linkSelectors) {
            articleElements = document.querySelectorAll(selector);
            if (articleElements.length > 0) {
              console.log(`Found ${articleElements.length} articles using selector: ${selector}`);
              break;
            }
          }
        }
        
        const articles = [];

        for (const element of articleElements) {
          let titleElement, linkElement;
          
          if (element.tagName === 'A') {
            // If element is already a link
            titleElement = element;
            linkElement = element;
          } else {
            // If element is a container
            titleElement = element.querySelector('h1, h2, h3, h4, .title, .headline, a[href*="/"]');
            linkElement = element.querySelector('a[href*="/"]') || titleElement;
          }
          
          if (titleElement && linkElement) {
            const title = titleElement.textContent?.trim();
            const href = linkElement.getAttribute('href');
            
            if (title && href && title.length > 10) { // Filter out very short titles
              articles.push({
                title,
                link: href.startsWith('http') ? href : 'https://pontianakpost.jawapos.com' + href,
              });
            }
          }
        }

        return articles;
      });

      console.log(`Found ${articles.length} articles on page ${currentPage}`);
      
      // Debug: Log first few articles found
      if (articles.length > 0) {
        console.log('Sample articles found:', articles.slice(0, 3).map(a => ({ title: a.title.substring(0, 50) + '...', link: a.link })));
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
              await prisma.scrappingBerita.create({
                data: {
                  idBerita,
                  portalBerita: scrapedItem.portal,
                  linkBerita: scrapedItem.link,
                  judul: scrapedItem.title,
                  isi: scrapedItem.content,
                  tanggalBerita: scrapedItem.date,
                  matchedKeywords: scrapedItem.matchedKeywords,
                },
              });

              // Update keyword match counts
              await prisma.scrappingKeyword.updateMany({
                where: { keyword: { in: scrapedItem.matchedKeywords } },
                data: { matchCount: { increment: 1 } },
              });

              result.newItems++;
              result.scrapedItems.push(scrapedItem);
              console.log(`✓ Saved: ${scrapedItem.title.substring(0, 50)}...`);

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

      // Check if we should continue to next page
      const hasNextPage = await page.evaluate(() => {
        const nextButton = document.querySelector('a[href*="page"]:last-child, .next, .pagination .next');
        return nextButton && !nextButton.classList.contains('disabled');
      });

      if (!hasNextPage) {
        console.log('No more pages found, stopping pagination');
        break;
      }

      currentPage++;
      await new Promise(resolve => setTimeout(resolve, delayMs)); // Rate limiting between pages

    } catch (pageError: unknown) {
      const errorMessage = pageError instanceof Error ? pageError.message : 'Unknown page error';
      console.error(`Error scraping page ${currentPage}:`, errorMessage);
      result.errors.push(`Page ${currentPage} error: ${errorMessage}`);
      break; // Stop pagination on page error
    }
  }
}

async function scrapeKalbarOnline(
  page: Page, 
  baseUrl: string, 
  maxPages: number, 
  delayMs: number,
  keywords: string[],
  result: ScrapingResult
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
              await prisma.scrappingBerita.create({
                data: {
                  idBerita,
                  portalBerita: scrapedItem.portal,
                  linkBerita: scrapedItem.link,
                  judul: scrapedItem.title,
                  isi: scrapedItem.content,
                  tanggalBerita: scrapedItem.date,
                  matchedKeywords: scrapedItem.matchedKeywords,
                },
              });

              // Update keyword match counts
              await prisma.scrappingKeyword.updateMany({
                where: { keyword: { in: scrapedItem.matchedKeywords } },
                data: { matchCount: { increment: 1 } },
              });

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