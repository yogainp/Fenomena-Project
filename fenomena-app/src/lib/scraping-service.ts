import axios from 'axios';
import * as cheerio from 'cheerio';
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

// Parse Indonesian date format
function parseIndonesianDate(dateStr: string): Date | null {
  try {
    // Clean the date string
    const cleanedDate = dateStr.toLowerCase()
      .replace(/\s*\|\s*\d{2}:\d{2}\s*(wib|wit|wita)?/i, '') // Remove time part
      .replace(/^(senin|selasa|rabu|kamis|jumat|sabtu|minggu),?\s*/i, '') // Remove day name
      .trim();

    // Pattern: DD Month YYYY (e.g., "11 agustus 2025")
    const match = cleanedDate.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
    if (match) {
      const day = parseInt(match[1]);
      const monthName = match[2].toLowerCase();
      const year = parseInt(match[3]);
      
      const month = INDONESIAN_MONTHS[monthName];
      if (month !== undefined) {
        return new Date(year, month, day);
      }
    }
  } catch (error) {
    console.warn('Error parsing Indonesian date:', dateStr, error);
  }
  
  return null;
}

// Helper function to extract date from article element
function extractArticleDate($: cheerio.CheerioAPI, articleElement: cheerio.Cheerio<any>, portalUrl: string): Date {
  if (portalUrl.includes('pontianakpost')) {
    // For Pontianak Post, look for date element near the title
    const dateElement = articleElement.parent().find('date.latest__date').first();
    if (dateElement.length) {
      const dateText = dateElement.text().trim();
      const parsedDate = parseIndonesianDate(dateText);
      if (parsedDate) {
        console.log(`✓ Parsed date: ${dateText} → ${parsedDate.toISOString()}`);
        return parsedDate;
      }
    }
    
    // Also try to find date in nearby elements
    const nearbyDate = articleElement.closest('.latest__item, .news-item, .post').find('date, .date, .latest__date').first();
    if (nearbyDate.length) {
      const dateText = nearbyDate.text().trim();
      const parsedDate = parseIndonesianDate(dateText);
      if (parsedDate) {
        return parsedDate;
      }
    }
  } else {
    // Generic date extraction for other portals
    const dateSelectors = [
      '.post-date',
      '.entry-date', 
      '.published',
      '.date',
      'time',
      '.meta-date',
      '[datetime]'
    ];
    
    for (const selector of dateSelectors) {
      const dateElement = articleElement.find(selector).first();
      if (dateElement.length) {
        const dateText = dateElement.attr('datetime') || dateElement.text().trim();
        const parsedDate = new Date(dateText);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate;
        }
      }
    }
  }
  
  // Fallback to current date if no date found
  console.warn('⚠️ No valid date found, using current date');
  return new Date();
}

// Helper function to clean and extract text content
function cleanTextContent(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
}

export async function scrapeNewsFromPortal(options: ScrapingOptions): Promise<ScrapingResult> {
  const { portalUrl, maxPages, delayMs } = options;
  
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

    const keywordList = activeKeywords.map(k => (k.keyword as string).toLowerCase());
    console.log(`Starting scraping with ${keywordList.length} active keywords:`, keywordList);

    // Sets to track processed items
    const processedUrls = new Set<string>();
    const processedTitles = new Set<string>();

    // Configure axios with enhanced headers - special handling for Pontianak Post
    let axiosConfig: any = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'DNT': '1',
        'Referer': 'https://www.google.com/',
        'Sec-CH-UA': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500, // Accept all status codes < 500
    };

    // Special configuration for Pontianak Post
    if (portalUrl.includes('pontianakpost')) {
      axiosConfig.headers = {
        ...axiosConfig.headers,
        'Referer': 'https://pontianakpost.jawapos.com/',
        'Origin': 'https://pontianakpost.jawapos.com',
        'Host': 'pontianakpost.jawapos.com',
        'X-Requested-With': 'XMLHttpRequest', // Sometimes helps with modern sites
      };
      // Longer timeout for potentially slower responses
      axiosConfig.timeout = 45000;
    }

    for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
      try {
        console.log(`Scraping page ${currentPage}...`);
        
        // Construct page URL with portal-specific logic
        let pageUrl: string;
        if (portalUrl.includes('pontianakpost')) {
          // Pontianak Post uses different pagination structure
          pageUrl = currentPage === 1 ? portalUrl : `${portalUrl}?page=${currentPage}`;
        } else {
          // Generic pagination for other portals
          pageUrl = currentPage === 1 ? portalUrl : `${portalUrl}/page/${currentPage}`;
        }
        
        // Add random delay to avoid rate limiting
        if (currentPage > 1) {
          const randomDelay = Math.random() * 2000 + 1000; // 1-3 seconds
          await new Promise(resolve => setTimeout(resolve, randomDelay));
        }

        // Fetch page content with retry logic
        let response;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
          try {
            response = await axios.get(pageUrl, axiosConfig);
            
            // Check if we got blocked (403, 429, or suspicious content)
            if (response.status === 403 || response.status === 429) {
              throw new Error(`HTTP ${response.status}: Access blocked`);
            }
            
            break; // Success, exit retry loop
            
          } catch (error: any) {
            retryCount++;
            console.warn(`Attempt ${retryCount} failed for ${pageUrl}:`, error.message);
            
            if (retryCount >= maxRetries) {
              throw error; // Re-throw after max retries
            }
            
            // Wait longer between retries with exponential backoff
            const backoffDelay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
            console.log(`Retrying in ${Math.round(backoffDelay/1000)}s...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            
            // Update headers to look more varied
            axiosConfig.headers['User-Agent'] = retryCount % 2 === 0 
              ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
          }
        }

        const $ = cheerio.load(response!.data);
        
        // Extract articles from the page - add selectors specific to different portals
        let articles: any[] = [];
        
        if (portalUrl.includes('pontianakpost')) {
          // Specific selectors for Pontianak Post based on actual HTML structure
          articles = $('h2.latest__title').toArray();
        } else if (portalUrl.includes('kalbaronline')) {
          // Specific selectors for Kalbar Online
          articles = $('.post, .entry, .news-item, article').toArray();
        } else if (portalUrl.includes('antaranews')) {
          // Specific selectors for Antara News
          articles = $('.simple-post, .post, article, .news-item').toArray();
        } else {
          // Generic selectors
          articles = $('.post, .entry, article, .news-item').toArray();
        }
        
        if (articles.length === 0) {
          // Debug: log page structure for troubleshooting
          if (portalUrl.includes('pontianakpost')) {
            console.log(`Debug: Pontianak Post - No articles found. Page structure sample:`, 
              $('body').find('*[class*="post"], *[class*="item"], *[class*="article"], *[id*="post"]').length > 0
                ? 'Found potential post elements'
                : 'No post elements found'
            );
            
            // Try alternative selectors for debugging
            const altSelectors = [
              'div[class*="post"]', 'div[class*="item"]', 'div[class*="news"]',
              'h2', 'h3', '.title', '*[href*="/"]'
            ];
            
            for (const selector of altSelectors) {
              const count = $(selector).length;
              if (count > 0) {
                console.log(`Debug: Found ${count} elements with selector: ${selector}`);
              }
            }
          }
          
          console.log(`No articles found on page ${currentPage}, stopping...`);
          break;
        }

        console.log(`Found ${articles.length} articles on page ${currentPage}`);

        for (const articleElement of articles) {
          try {
            const $article = $(articleElement);
            
            // Extract article data with portal-specific selectors
            let title: string, relativeLink: string;
            
            if (portalUrl.includes('pontianakpost')) {
              // For Pontianak Post, $article is already the h2.latest__title element
              const linkElement = $article.find('a.latest__link').first();
              if (!linkElement.length) {
                continue;
              }
              
              title = cleanTextContent(linkElement.text());
              relativeLink = linkElement.attr('href') || '';
            } else {
              // For other portals, use generic approach
              const titleElement = $article.find('h1, h2, h3, .entry-title, .post-title, .title').first();
              const linkElement = $article.find('a').first();
              
              if (!titleElement.length || !linkElement.length) {
                continue;
              }
              
              title = cleanTextContent(titleElement.text());
              relativeLink = linkElement.attr('href') || '';
            }
            
            if (!title || !relativeLink) {
              continue;
            }

            // Convert relative link to absolute
            const link = relativeLink.startsWith('http') 
              ? relativeLink 
              : new URL(relativeLink, portalUrl).href;

            // Check for duplicates
            if (await checkDuplicateArticle(title, link, processedUrls, processedTitles)) {
              result.duplicates++;
              continue;
            }

            // Check if title matches any keywords
            const titleLower = title.toLowerCase();
            const matchedKeywords = keywordList.filter(keyword => 
              titleLower.includes(keyword)
            );

            if (matchedKeywords.length === 0) {
              continue; // Skip if no keywords match
            }

            // Fetch full article content with delay
            let content = '';
            try {
              // Small delay before fetching article content
              await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
              
              const articleResponse = await axios.get(link, axiosConfig);
              const $articlePage = cheerio.load(articleResponse.data);
              
              // Try different content selectors
              const contentSelectors = [
                '.entry-content',
                '.post-content', 
                '.article-content',
                '.content',
                'main',
                '.single-content'
              ];
              
              for (const selector of contentSelectors) {
                const contentElement = $articlePage(selector).first();
                if (contentElement.length) {
                  content = cleanTextContent(contentElement.text());
                  break;
                }
              }
              
              // Fallback: get text from common paragraph containers
              if (!content) {
                content = cleanTextContent($articlePage('p').text());
              }
              
            } catch (contentError) {
              console.warn(`Failed to fetch content for ${link}:`, contentError);
              content = title; // Use title as fallback content
            }

            // Extract date with portal-specific logic
            const date = extractArticleDate($, $article, portalUrl);

            // Create news item
            const newsItem: ScrapedNewsItem = {
              title,
              content: content || title,
              link,
              date,
              portal: portalUrl,
              matchedKeywords,
            };

            // Save to database
            try {
              await saveScrapedArticle({
                idBerita: crypto.randomUUID(),
                portalBerita: portalUrl,
                linkBerita: link,
                judul: title,
                isi: content || title,
                tanggalBerita: date,
                matchedKeywords,
              });
              
              // Update keyword match counts
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
              processedUrls.add(link.toLowerCase());
              processedTitles.add(title.toLowerCase().trim());
              
              console.log(`✓ Scraped: ${title} (Keywords: ${matchedKeywords.join(', ')})`);
              
            } catch (saveError) {
              console.error('Error saving article:', saveError);
              result.errors.push(`Failed to save article: ${title}`);
            }

          } catch (articleError) {
            console.error('Error processing article:', articleError);
            result.errors.push(`Error processing article: ${articleError}`);
          }
        }

        result.totalScraped += articles.length;

        // Add delay between pages
        if (currentPage < maxPages && delayMs > 0) {
          console.log(`Waiting ${delayMs}ms before next page...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

      } catch (pageError) {
        console.error(`Error scraping page ${currentPage}:`, pageError);
        result.errors.push(`Error on page ${currentPage}: ${pageError}`);
        
        // Continue with next page instead of breaking
        continue;
      }
    }

    result.success = true;
    console.log(`Scraping completed. New items: ${result.newItems}, Duplicates: ${result.duplicates}`);

  } catch (error) {
    console.error('Scraping failed:', error);
    result.errors.push(`Scraping failed: ${error}`);
  }

  return result;
}

// Export function to test scraping on a single URL
export async function testScrapeUrl(url: string): Promise<{
  success: boolean;
  title?: string;
  content?: string;
  error?: string;
}> {
  try {
    const axiosConfig = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'max-age=0',
        'Referer': 'https://www.google.com/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
      },
      timeout: 30000,
      validateStatus: (status) => status < 500,
    };

    const response = await axios.get(url, axiosConfig);
    const $ = cheerio.load(response.data);
    
    // Extract title
    const title = $('h1, .entry-title, .post-title, .title').first().text().trim() || 
                  $('title').text().trim();
    
    // Extract content
    const contentSelectors = ['.entry-content', '.post-content', '.article-content', '.content', 'main'];
    let content = '';
    
    for (const selector of contentSelectors) {
      const contentElement = $(selector).first();
      if (contentElement.length) {
        content = cleanTextContent(contentElement.text());
        break;
      }
    }
    
    return {
      success: true,
      title,
      content: content || 'No content found',
    };
    
  } catch (error) {
    return {
      success: false,
      error: `Failed to scrape URL: ${error}`,
    };
  }
}