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

// Helper function to extract date from article element
function extractArticleDate($: cheerio.CheerioAPI, articleElement: cheerio.Cheerio<any>): Date {
  // Try different date selectors commonly used in news sites
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
  
  // Fallback to current date if no date found
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

    // Configure axios with headers to mimic a real browser
    const axiosConfig = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 30000, // 30 second timeout
    };

    for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
      try {
        console.log(`Scraping page ${currentPage}...`);
        
        // Construct page URL
        const pageUrl = currentPage === 1 ? portalUrl : `${portalUrl}/page/${currentPage}`;
        
        // Fetch page content
        const response = await axios.get(pageUrl, axiosConfig);
        const $ = cheerio.load(response.data);
        
        // Extract articles from the page
        const articles = $('.post, .entry, article, .news-item').toArray();
        
        if (articles.length === 0) {
          console.log(`No articles found on page ${currentPage}, stopping...`);
          break;
        }

        console.log(`Found ${articles.length} articles on page ${currentPage}`);

        for (const articleElement of articles) {
          try {
            const $article = $(articleElement);
            
            // Extract article data
            const titleElement = $article.find('h1, h2, h3, .entry-title, .post-title, .title').first();
            const linkElement = $article.find('a').first();
            
            if (!titleElement.length || !linkElement.length) {
              continue;
            }

            const title = cleanTextContent(titleElement.text());
            const relativeLink = linkElement.attr('href');
            
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

            // Fetch full article content
            let content = '';
            try {
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

            // Extract date
            const date = extractArticleDate($, $article);

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
                  await incrementKeywordMatchCount(keywordObj.id);
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      timeout: 30000,
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