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

            // Try to extract date
            const dateSelectors = [
              '.post-date',
              '.published-date',
              '.date',
              'time',
              '.meta-date',
              '[datetime]',
              '.entry-date'
            ];

            let dateString = '';
            for (const selector of dateSelectors) {
              const dateElement = document.querySelector(selector);
              if (dateElement) {
                dateString = dateElement.textContent?.trim() || dateElement.getAttribute('datetime') || '';
                if (dateString) break;
              }
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