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
    } else {
      throw new Error('Unsupported portal. Currently only supports pontianakpost.jawapos.com');
    }

    result.success = true;
    console.log(`Scraping completed. Total: ${result.totalScraped}, New: ${result.newItems}, Duplicates: ${result.duplicates}`);

  } catch (error: any) {
    console.error('Scraping error:', error);
    result.errors.push(error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return result;
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

            // Try to extract date
            const dateSelectors = [
              '.post-date',
              '.published-date',
              '.date',
              'time',
              '.meta-date',
              '[datetime]'
            ];

            let dateString = '';
            for (const selector of dateSelectors) {
              const dateElement = document.querySelector(selector);
              if (dateElement) {
                dateString = dateElement.textContent?.trim() || dateElement.getAttribute('datetime') || '';
                if (dateString) break;
              }
            }

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

          // Parse date (fallback to current date if parsing fails)
          let articleDate: Date;
          try {
            articleDate = articleData.dateString ? new Date(articleData.dateString) : new Date();
            if (isNaN(articleDate.getTime())) {
              articleDate = new Date(); // Fallback to current date
            }
          } catch {
            articleDate = new Date(); // Fallback to current date
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

            } catch (dbError: any) {
              if (dbError.code === 'P2002') {
                result.duplicates++;
                console.log(`⚠ Duplicate: ${scrapedItem.title.substring(0, 50)}...`);
              } else {
                result.errors.push(`Database error: ${dbError.message}`);
                console.error('Database error:', dbError);
              }
            }

            result.totalScraped++;
          }

        } catch (articleError: any) {
          console.error(`Error scraping article ${article.link}:`, articleError.message);
          result.errors.push(`Article error: ${articleError.message}`);
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

    } catch (pageError: any) {
      console.error(`Error scraping page ${currentPage}:`, pageError.message);
      result.errors.push(`Page ${currentPage} error: ${pageError.message}`);
      break; // Stop pagination on page error
    }
  }
}