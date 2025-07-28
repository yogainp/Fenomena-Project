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
    const page = await browser.newPage();

    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

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
      
      // Wait for articles to load
      await page.waitForSelector('article, .post, .news-item', { timeout: 10000 });

      // Extract article links and titles
      const articles = await page.evaluate(() => {
        const articleElements = document.querySelectorAll('article, .post, .news-item, .card');
        const articles = [];

        for (const element of articleElements) {
          const titleElement = element.querySelector('h1, h2, h3, h4, .title, .headline, a[href*="/"]');
          const linkElement = element.querySelector('a[href*="/"]') || titleElement;
          
          if (titleElement && linkElement) {
            const title = titleElement.textContent?.trim();
            const href = linkElement.getAttribute('href');
            
            if (title && href) {
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

      // Filter articles by keywords in title
      const relevantArticles = articles.filter(article => 
        keywords.some(keyword => 
          article.title.toLowerCase().includes(keyword)
        )
      );

      console.log(`Found ${relevantArticles.length} relevant articles (containing keywords)`);

      // Scrape content from relevant articles
      for (const article of relevantArticles) {
        try {
          await page.goto(article.link, { waitUntil: 'networkidle', timeout: 30000 });
          await new Promise(resolve => setTimeout(resolve, delayMs)); // Rate limiting

          // Extract article content
          const articleData = await page.evaluate((articleTitle, articleLink) => {
            // Try multiple selectors for content
            const contentSelectors = [
              '.post-content',
              '.article-content', 
              '.content',
              '.entry-content',
              'article .content',
              '.post-body',
              '.article-body'
            ];

            let content = '';
            for (const selector of contentSelectors) {
              const contentElement = document.querySelector(selector);
              if (contentElement) {
                content = contentElement.textContent?.trim() || '';
                if (content.length > 100) break; // Use the selector that gives substantial content
              }
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

            return {
              title: articleTitle,
              content: content || 'Content could not be extracted',
              link: articleLink,
              dateString,
            };
          }, article.title, article.link);

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