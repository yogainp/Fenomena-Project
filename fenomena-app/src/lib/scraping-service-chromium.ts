import puppeteer, { Browser, Page } from 'puppeteer';
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

// Indonesian month names mapping
const INDONESIAN_MONTHS: { [key: string]: number } = {
  'januari': 0, 'februari': 1, 'maret': 2, 'april': 3, 'mei': 4, 'juni': 5,
  'juli': 6, 'agustus': 7, 'september': 8, 'oktober': 9, 'november': 10, 'desember': 11,
  'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'jun': 5, 'jul': 6,
  'agu': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'des': 11
};

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
  
  try {
    // Try standard ISO format first (YYYY-MM-DDTHH:mm:ss)
    const isoDate = new Date(cleanedDate);
    if (!isNaN(isoDate.getTime()) && (cleanedDate.includes('T') || cleanedDate.match(/^\d{4}-\d{2}-\d{2}/))) {
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
    ];
    
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = cleanedDate.match(pattern);
      
      if (match) {
        console.log(`Matched pattern ${i + 1}: ${pattern}`);
        console.log(`Match groups:`, match);
        
        let day: number, month: number, year: number;
        
        if (i === 0 || i === 1 || i === 7) {
          // ISO format: YYYY-MM-DD
          year = parseInt(match[1]);
          month = parseInt(match[2]) - 1; // Convert to 0-based month
          day = parseInt(match[3] || '1');
        } else if (i === 2 || i === 3 || i === 4) {
          // DD Month YYYY format
          day = parseInt(match[1]);
          const monthName = match[2].toLowerCase();
          month = INDONESIAN_MONTHS[monthName];
          year = parseInt(match[3]);
        } else if (i === 5) {
          // Month DD, YYYY format  
          const monthName = match[1].toLowerCase();
          month = INDONESIAN_MONTHS[monthName];
          day = parseInt(match[2]);
          year = parseInt(match[3]);
        } else if (i === 6) {
          // DD-MM-YYYY format
          day = parseInt(match[1]);
          month = parseInt(match[2]) - 1; // Convert to 0-based month
          year = parseInt(match[3]);
        } else {
          continue;
        }
        
        // Validate parsed values
        if (month !== undefined && !isNaN(month) && month >= 0 && month <= 11 &&
            !isNaN(day) && day >= 1 && day <= 31 &&
            !isNaN(year) && year >= 2020 && year <= 2030) {
          
          const parsedDate = new Date(year, month, day);
          console.log(`✅ Successfully parsed: ${parsedDate.toISOString()}`);
          console.log(`   Day: ${day}, Month: ${month + 1} (${Object.keys(INDONESIAN_MONTHS)[month]}), Year: ${year}`);
          return parsedDate;
        } else {
          console.log(`❌ Invalid parsed values: day=${day}, month=${month}, year=${year}`);
        }
      }
    }
    
    console.log(`❌ No pattern matched for: "${cleanedDate}"`);
    
  } catch (error) {
    console.error('Error in date parsing:', error);
  }
  
  // Fallback to current date
  console.log('⚠️ Using current date as fallback');
  return new Date();
}

// Pontianak Post scraping function with Chromium
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
      console.log(`[CHROMIUM] Scraping page ${currentPage}: ${pageUrl}`);

      await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait for page content to load
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
        console.log('[CHROMIUM] No content found on page, skipping...');
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
            console.log(`✅ [PONTIANAKPOST-CHROMIUM] Found ${elements.length} articles in LATEST NEWS section using selector: "${selector}"`);
            
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
        
        // Additional fallback selectors if needed
        if (!articleElements || articleElements.length === 0) {
          console.log('❌ [PONTIANAKPOST-CHROMIUM] No specific latest news section found, trying fallback selectors...');
          const fallbackSelectors = [
            'h2.latest__title', // Direct selector 
            '.latest__title', // Class selector
            'h2 a[href*="/"]', // Any h2 with links
          ];
          
          for (const selector of fallbackSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              articleElements = elements;
              console.log(`Found ${elements.length} articles using fallback selector: ${selector}`);
              break;
            }
          }
        }
        
        const articles: any[] = [];

        if (articleElements) {
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
                  dateElement = parentElement.querySelector('.latest__date, span.latest__date, date.latest__date');
                  
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
                
                console.log(`🎯 [PONTIANAKPOST-CHROMIUM] Found h2.latest__title: "${title.substring(0, 50)}..." | Date: "${dateString}"`);
              }
            } else if (element.tagName === 'H2') {
              // Fallback for h2 without latest__title class
              const linkElement = element.querySelector('a[href*="/"]');
              if (linkElement) {
                title = linkElement.textContent?.trim() || '';
                href = linkElement.getAttribute('href') || '';
                console.log(`⚠️ [PONTIANAKPOST-CHROMIUM] Found h2 (not latest__title): "${title.substring(0, 50)}..."`);
              }
            } else if (element.classList.contains('latest__title')) {
              // Direct latest__title element
              const linkElement = element.querySelector('a[href*="/"]') || element;
              if (linkElement && linkElement.getAttribute('href')) {
                title = linkElement.textContent?.trim() || '';
                href = linkElement.getAttribute('href') || '';
              }
            } else if (element.tagName === 'A') {
              // Direct link element
              title = element.textContent?.trim() || '';
              href = element.getAttribute('href') || '';
            }
            
            if (title && href && title.length > 5) {
              const fullLink = href.startsWith('http') ? href : 'https://pontianakpost.jawapos.com' + href;
              articles.push({
                title,
                link: fullLink,
                dateString // Include date for later processing
              });
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
            console.log(`[CHROMIUM] Excluding popular article: ${article.title.substring(0, 30)}...`);
            return false;
          }
          
          return true;
        });
        
        console.log(`[CHROMIUM] Original articles: ${articles.length}, After filtering popular: ${filteredArticles.length}`);
        return filteredArticles;
      });

      console.log(`✓ [PONTIANAKPOST-CHROMIUM] Found ${articles.length} articles on page ${currentPage}`);
      
      // Filter articles by keywords in title
      const relevantArticles = articles.filter(article => 
        keywords.some(keyword => 
          article.title.toLowerCase().includes(keyword)
        )
      );

      console.log(`[CHROMIUM] Found ${relevantArticles.length} relevant articles (containing keywords)`);
      
      // If no articles found at all, might be end of content or blocked
      if (articles.length === 0) {
        console.log(`[CHROMIUM] No articles found on page ${currentPage}, stopping pagination`);
        break;
      }
      
      // Scrape content from relevant articles
      for (const article of relevantArticles) {
        try {
          // Check for duplicates
          if (await checkDuplicateArticle(article.title, article.link, processedUrls, processedTitles)) {
            result.duplicates++;
            continue;
          }

          await page.goto(article.link, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await new Promise(resolve => setTimeout(resolve, delayMs)); // Rate limiting

          // Extract article content and date
          const articleData = await page.evaluate(({ articleTitle, articleLink, articleDateString }) => {
            // Try multiple selectors for content
            const contentSelectors = [
              '.post-content',
              '.article-content', 
              '.content',
              '.entry-content',
              'article .content',
              '.post-body',
              '.article-body',
              '.single-content',
              '.text-content',
              '.main-content',
              '.news-content',
              '.story-content',
              '.body-text',
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

            // Try to find date on the article page
            let dateString = articleDateString || '';
            if (!dateString) {
              const dateSelectors = [
                'date.latest__date',
                '.latest__date',
                '.post-date',
                '.entry-date', 
                '.published',
                '.date',
                'time',
                '.meta-date',
                '[datetime]'
              ];
              
              for (const selector of dateSelectors) {
                const dateElement = document.querySelector(selector);
                if (dateElement) {
                  dateString = dateElement.textContent?.trim() || dateElement.getAttribute('datetime') || '';
                  if (dateString) break;
                }
              }
            }
            
            return {
              content: content || articleTitle, // Fallback to title if no content
              dateString
            };
          }, { 
            articleTitle: article.title, 
            articleLink: article.link, 
            articleDateString: article.dateString 
          });

          // Parse date
          const parsedDate = parseIndonesianDate(articleData.dateString);

          // Get matched keywords
          const matchedKeywords = keywords.filter(keyword => 
            article.title.toLowerCase().includes(keyword)
          );

          // Create news item
          const newsItem: ScrapedNewsItem = {
            title: article.title,
            content: articleData.content,
            link: article.link,
            date: parsedDate,
            portal: baseUrl,
            matchedKeywords,
          };

          // Save to database
          try {
            await saveScrapedArticle({
              idBerita: crypto.randomUUID(),
              portalBerita: baseUrl,
              linkBerita: article.link,
              judul: article.title,
              isi: articleData.content,
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
            
            console.log(`✓ [CHROMIUM] Scraped: ${article.title.substring(0, 50)}... (Keywords: ${matchedKeywords.join(', ')})`);
            
          } catch (saveError) {
            console.error('[CHROMIUM] Error saving article:', saveError);
            result.errors.push(`Failed to save article: ${article.title}`);
          }

        } catch (articleError) {
          console.error('[CHROMIUM] Error processing article:', articleError);
          result.errors.push(`Error processing article: ${article.title}`);
        }
      }

      result.totalScraped += articles.length;

      // Add delay between pages
      if (currentPage < maxPages && delayMs > 0) {
        console.log(`[CHROMIUM] Waiting ${delayMs}ms before next page...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      currentPage++;

    } catch (pageError) {
      console.error(`[CHROMIUM] Error scraping page ${currentPage}:`, pageError);
      result.errors.push(`Error on page ${currentPage}: ${pageError}`);
      break; // Stop on page errors for Chromium scraping
    }
  }
}

// Main export function for Chromium scraping (Pontianak Post only)
export async function scrapeNewsFromPortalChromium(options: ScrapingOptions): Promise<ScrapingResult> {
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
    // Only support Pontianak Post for Chromium scraping
    if (!portalUrl.includes('pontianakpost.jawapos.com')) {
      throw new Error('Chromium scraping is only supported for Pontianak Post. Use Axios scraping for other portals.');
    }

    // Get active keywords from database
    const activeKeywords = await getActiveKeywords();

    if (activeKeywords.length === 0) {
      throw new Error('No active keywords found. Please add keywords first.');
    }

    const keywordList = activeKeywords.map(k => (k.keyword as string).toLowerCase());
    console.log(`[CHROMIUM] Starting scraping with ${keywordList.length} active keywords:`, keywordList);

    // Launch browser with optimized settings
    browser = await puppeteer.launch({ 
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    // Create page with user agent and headers
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none'
    });

    // Create tracking sets for duplicate prevention
    const processedUrls = new Set<string>();
    const processedTitles = new Set<string>();

    // Scrape Pontianak Post with Chromium
    await scrapePontianakPost(page, portalUrl, maxPages, delayMs, keywordList, result, processedUrls, processedTitles);

    result.success = true;
    console.log(`[CHROMIUM] Scraping completed. Total: ${result.totalScraped}, New: ${result.newItems}, Duplicates: ${result.duplicates}`);

  } catch (error: unknown) {
    console.error('[CHROMIUM] Scraping error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown scraping error';
    result.errors.push(errorMessage);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return result;
}

// Export function to test chromium scraping on a single URL
export async function testScrapeUrlChromium(url: string): Promise<{
  success: boolean;
  title?: string;
  content?: string;
  error?: string;
}> {
  let browser: Browser | null = null;
  
  try {
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    const result = await page.evaluate(() => {
      // Extract title
      const title = document.querySelector('h1, .entry-title, .post-title, .title')?.textContent?.trim() || 
                    document.title;
      
      // Extract content
      const contentSelectors = ['.entry-content', '.post-content', '.article-content', '.content', 'main'];
      let content = '';
      
      for (const selector of contentSelectors) {
        const contentElement = document.querySelector(selector);
        if (contentElement) {
          content = contentElement.textContent?.trim() || '';
          if (content.length > 100) break;
        }
      }
      
      return {
        title,
        content: content || 'No content found',
      };
    });
    
    return {
      success: true,
      ...result,
    };
    
  } catch (error) {
    return {
      success: false,
      error: `Failed to scrape URL with Chromium: ${error}`,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}