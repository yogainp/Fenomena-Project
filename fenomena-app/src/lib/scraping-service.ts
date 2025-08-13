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

// Helper function to parse Indonesian date strings - Enhanced version from Chromium
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
    .replace(/\s+pukul\s+\d{1,2}[:.].\d{2}.*$/i, '') // Remove time info like "pukul 14:30"
    .replace(/\s+\d{1,2}[:.].\d{2}([:.].\d{2})?.*$/i, '') // Remove time info like "14:30:00"
    .replace(/\s+jam\s+\d{1,2}[:.].\d{2}.*$/i, '') // Remove "jam 14:30"
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
      /(\d{1,2})\s+(\w+)\s+(\d{4})[,\s]+\d{1,2}[:.].\d{2}/i,
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

// Antara News scraping function with specific selectors and logic
async function scrapeAntaranews(
  $: cheerio.CheerioAPI,
  baseUrl: string, 
  currentPage: number,
  maxPages: number, 
  delayMs: number,
  keywords: string[],
  result: ScrapingResult,
  processedUrls: Set<string>,
  processedTitles: Set<string>,
  axiosConfig: any
): Promise<void> {
  try {
    console.log(`[ANTARA] Scraping page ${currentPage}: ${baseUrl}`);

    // Find articles using Antara News specific selectors
    const articleElements = $('.berita-title, a[href*="/berita/"]').toArray();
    
    if (articleElements.length === 0) {
      console.log('[ANTARA] No articles found on page, trying alternative selectors...');
      // Try alternative selectors for Antara News
      const altElements = $('h2 a, h3 a, .post-title a, .entry-title a').toArray();
      if (altElements.length === 0) {
        console.log('[ANTARA] No articles found with any selector, stopping...');
        return;
      }
      articleElements.push(...altElements);
    }

    console.log(`✓ [ANTARA] Found ${articleElements.length} articles on page ${currentPage}`);

    // Step 1: Extract all articles and check keywords FIRST
    const relevantArticles: Array<{title: string, link: string, dateString: string, matchedKeywords: string[]}> = [];

    for (const articleElement of articleElements) {
      try {
        const $article = $(articleElement);
        
        // Extract title and link for Antara News
        let title: string, link: string;
        
        if ($article.hasClass('berita-title')) {
          const linkElement = $article.find('a').first();
          title = cleanTextContent($article.text());
          link = linkElement.attr('href') || '';
        } else if ($article.is('a[href*="/berita/"]')) {
          title = cleanTextContent($article.text());
          link = $article.attr('href') || '';
        } else {
          // Fallback for other elements
          title = cleanTextContent($article.text());
          link = $article.attr('href') || '';
        }
        
        if (!title || !link || title.length < 10) {
          continue;
        }

        // Convert relative link to absolute
        const fullLink = link.startsWith('http') 
          ? link 
          : new URL(link, 'https://kalbar.antaranews.com').href;

        // Step 2: Check if title matches any keywords BEFORE duplicate check
        const titleLower = title.toLowerCase();
        const matchedKeywords = keywords.filter(keyword => titleLower.includes(keyword));

        if (matchedKeywords.length === 0) {
          continue; // Skip if no keywords match - don't even process further
        }

        // Find date - Antara News specific
        let dateString = '';
        const dateElement = $article.parent().find('time, .date, .post-date').first();
        if (dateElement.length) {
          dateString = dateElement.attr('datetime') || dateElement.text().trim();
        }
        
        // If no date found in parent, look in nearby siblings
        if (!dateString) {
          const nearbyDate = $article.closest('div, article').find('time, .date, .post-date').first();
          if (nearbyDate.length) {
            dateString = nearbyDate.attr('datetime') || nearbyDate.text().trim();
          }
        }

        // Add to relevant articles for processing
        relevantArticles.push({
          title,
          link: fullLink,
          dateString,
          matchedKeywords
        });

      } catch (articleError) {
        console.error('[ANTARA] Error extracting article info:', articleError);
        continue;
      }
    }

    console.log(`📊 [ANTARA] From ${articleElements.length} articles on page ${currentPage}, found ${relevantArticles.length} articles matching keywords`);

    // Step 3: Process relevant articles (check duplicates, fetch content, save)
    for (const article of relevantArticles) {
      try {
        console.log(`🔍 [ANTARA] Processing: "${article.title.substring(0, 60)}..." (Keywords: ${article.matchedKeywords.join(', ')})`);

        // Check for duplicates AFTER keyword filtering
        if (await checkDuplicateArticle(article.title, article.link, processedUrls, processedTitles)) {
          console.log(`⚠️ [ANTARA] Duplicate found, skipping: "${article.title.substring(0, 40)}..."`);
          result.duplicates++;
          continue;
        }

        // Parse date with our enhanced function
        const parsedDate = parseIndonesianDate(article.dateString);

        // Fetch full article content
        let content = '';
        try {
          console.log(`📥 [ANTARA] Fetching content from: ${article.link}`);
          await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
          
          const articleResponse = await axios.get(article.link, axiosConfig);
          const $articlePage = cheerio.load(articleResponse.data);
          
          // Antara News content selectors
          const contentSelectors = [
            '.post-content',
            '.entry-content',
            '.article-content',
            '.content',
            'main p',
            '.post-body p'
          ];
          
          for (const selector of contentSelectors) {
            const contentElement = $articlePage(selector).first();
            if (contentElement.length) {
              content = cleanTextContent(contentElement.text());
              if (content.length > 100) {
                console.log(`✅ [ANTARA] Content extracted using selector: ${selector} (${content.length} chars)`);
                break;
              }
            }
          }
          
          if (!content) {
            content = cleanTextContent($articlePage('p').text());
            console.log(`⚠️ [ANTARA] Using fallback paragraph content (${content.length} chars)`);
          }
          
        } catch (contentError) {
          console.warn(`❌ [ANTARA] Failed to fetch content for ${article.link}:`, contentError);
          content = article.title; // Use title as fallback content
        }

        // Create news item
        const newsItem: ScrapedNewsItem = {
          title: article.title,
          content: content || article.title,
          link: article.link,
          date: parsedDate,
          portal: baseUrl,
          matchedKeywords: article.matchedKeywords,
        };

        // Save to database
        try {
          await saveScrapedArticle({
            idBerita: crypto.randomUUID(),
            portalBerita: baseUrl,
            linkBerita: article.link,
            judul: article.title,
            isi: content || article.title,
            tanggalBerita: parsedDate,
            matchedKeywords: article.matchedKeywords,
          });
          
          // Update keyword match counts
          const activeKeywords = await getActiveKeywords();
          for (const keyword of article.matchedKeywords) {
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
          
          console.log(`✅ [ANTARA] Successfully scraped: "${article.title.substring(0, 50)}..." (Keywords: ${article.matchedKeywords.join(', ')})`);
          
        } catch (saveError) {
          console.error('❌ [ANTARA] Error saving article:', saveError);
          result.errors.push(`Failed to save article: ${article.title}`);
        }

      } catch (articleError) {
        console.error('❌ [ANTARA] Error processing relevant article:', articleError);
        result.errors.push(`Error processing article: ${article.title}`);
      }
    }

    result.totalScraped += articleElements.length;
    console.log(`📈 [ANTARA] Page ${currentPage} summary: ${articleElements.length} total articles, ${relevantArticles.length} keyword matches, ${result.newItems} saved, ${result.duplicates} duplicates`);

  } catch (pageError) {
    console.error(`❌ [ANTARA] Error scraping page ${currentPage}:`, pageError);
    result.errors.push(`Error on page ${currentPage}: ${pageError}`);
  }
}

// Kalbar Online scraping function with specific selectors and logic
async function scrapeKalbarOnline(
  $: cheerio.CheerioAPI,
  baseUrl: string, 
  currentPage: number,
  maxPages: number, 
  delayMs: number,
  keywords: string[],
  result: ScrapingResult,
  processedUrls: Set<string>,
  processedTitles: Set<string>,
  axiosConfig: any
): Promise<void> {
  try {
    console.log(`[KALBARONLINE] Scraping page ${currentPage}: ${baseUrl}`);

    // Find articles using Kalbar Online specific selectors
    const articleElements = $('h2.entry-title, .gmr-archive, .site-main-archive article').toArray();
    
    if (articleElements.length === 0) {
      console.log('[KALBARONLINE] No articles found on page, trying alternative selectors...');
      const altElements = $('.post, .entry, article, h2 a, h3 a').toArray();
      if (altElements.length === 0) {
        console.log('[KALBARONLINE] No articles found with any selector, stopping...');
        return;
      }
      articleElements.push(...altElements);
    }

    console.log(`✓ [KALBARONLINE] Found ${articleElements.length} articles on page ${currentPage}`);

    // Step 1: Extract all articles and check keywords FIRST
    const relevantArticles: Array<{title: string, link: string, dateString: string, matchedKeywords: string[]}> = [];

    for (const articleElement of articleElements) {
      try {
        const $article = $(articleElement);
        
        // Extract title and link for Kalbar Online
        let title: string, link: string;
        
        const titleElement = $article.find('h2.entry-title a, .entry-title a, h2 a, h3 a').first();
        if (titleElement.length) {
          title = cleanTextContent(titleElement.text());
          link = titleElement.attr('href') || '';
        } else if ($article.is('a')) {
          title = cleanTextContent($article.text());
          link = $article.attr('href') || '';
        } else {
          continue;
        }
        
        if (!title || !link || title.length < 10) {
          continue;
        }

        // Convert relative link to absolute
        const fullLink = link.startsWith('http') 
          ? link 
          : new URL(link, 'https://kalbaronline.com').href;

        // Step 2: Check if title matches any keywords BEFORE duplicate check
        const titleLower = title.toLowerCase();
        const matchedKeywords = keywords.filter(keyword => titleLower.includes(keyword));

        if (matchedKeywords.length === 0) {
          continue; // Skip if no keywords match - don't even process further
        }

        // Find date - Kalbar Online specific (DD/MM/YYYY format)
        let dateString = '';
        const dateElement = $article.find('.gmr-metacontent, .entry-meta, .post-date, time').first();
        if (dateElement.length) {
          dateString = dateElement.attr('datetime') || dateElement.text().trim();
        }
        
        // If no date found, look in parent container
        if (!dateString) {
          const nearbyDate = $article.closest('.gmr-archive, article, .post').find('.gmr-metacontent, .entry-meta, time').first();
          if (nearbyDate.length) {
            dateString = nearbyDate.attr('datetime') || nearbyDate.text().trim();
          }
        }

        // Add to relevant articles for processing
        relevantArticles.push({
          title,
          link: fullLink,
          dateString,
          matchedKeywords
        });

      } catch (articleError) {
        console.error('[KALBARONLINE] Error extracting article info:', articleError);
        continue;
      }
    }

    console.log(`📊 [KALBARONLINE] From ${articleElements.length} articles on page ${currentPage}, found ${relevantArticles.length} articles matching keywords`);

    // Step 3: Process relevant articles (check duplicates, fetch content, save)
    for (const article of relevantArticles) {
      try {
        console.log(`🔍 [KALBARONLINE] Processing: "${article.title.substring(0, 60)}..." (Keywords: ${article.matchedKeywords.join(', ')})`);

        // Check for duplicates AFTER keyword filtering
        if (await checkDuplicateArticle(article.title, article.link, processedUrls, processedTitles)) {
          console.log(`⚠️ [KALBARONLINE] Duplicate found, skipping: "${article.title.substring(0, 40)}..."`);
          result.duplicates++;
          continue;
        }

        // Parse date with our enhanced function
        const parsedDate = parseIndonesianDate(article.dateString);

        // Fetch full article content
        let content = '';
        try {
          console.log(`📥 [KALBARONLINE] Fetching content from: ${article.link}`);
          await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
          
          const articleResponse = await axios.get(article.link, axiosConfig);
          const $articlePage = cheerio.load(articleResponse.data);
          
          // Kalbar Online content selectors
          const contentSelectors = [
            '.entry-content',
            '.post-content',
            '.article-content',
            '.content',
            'main p',
            '.single-content p'
          ];
          
          for (const selector of contentSelectors) {
            const contentElement = $articlePage(selector).first();
            if (contentElement.length) {
              content = cleanTextContent(contentElement.text());
              if (content.length > 100) {
                console.log(`✅ [KALBARONLINE] Content extracted using selector: ${selector} (${content.length} chars)`);
                break;
              }
            }
          }
          
          if (!content) {
            content = cleanTextContent($articlePage('p').text());
            console.log(`⚠️ [KALBARONLINE] Using fallback paragraph content (${content.length} chars)`);
          }
          
        } catch (contentError) {
          console.warn(`❌ [KALBARONLINE] Failed to fetch content for ${article.link}:`, contentError);
          content = article.title; // Use title as fallback content
        }

        // Create news item
        const newsItem: ScrapedNewsItem = {
          title: article.title,
          content: content || article.title,
          link: article.link,
          date: parsedDate,
          portal: baseUrl,
          matchedKeywords: article.matchedKeywords,
        };

        // Save to database
        try {
          await saveScrapedArticle({
            idBerita: crypto.randomUUID(),
            portalBerita: baseUrl,
            linkBerita: article.link,
            judul: article.title,
            isi: content || article.title,
            tanggalBerita: parsedDate,
            matchedKeywords: article.matchedKeywords,
          });
          
          // Update keyword match counts
          const activeKeywords = await getActiveKeywords();
          for (const keyword of article.matchedKeywords) {
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
          
          console.log(`✅ [KALBARONLINE] Successfully scraped: "${article.title.substring(0, 50)}..." (Keywords: ${article.matchedKeywords.join(', ')})`);
          
        } catch (saveError) {
          console.error('❌ [KALBARONLINE] Error saving article:', saveError);
          result.errors.push(`Failed to save article: ${article.title}`);
        }

      } catch (articleError) {
        console.error('❌ [KALBARONLINE] Error processing relevant article:', articleError);
        result.errors.push(`Error processing article: ${article.title}`);
      }
    }

    result.totalScraped += articleElements.length;
    console.log(`📈 [KALBARONLINE] Page ${currentPage} summary: ${articleElements.length} total articles, ${relevantArticles.length} keyword matches, ${result.newItems} saved, ${result.duplicates} duplicates`);

  } catch (pageError) {
    console.error(`❌ [KALBARONLINE] Error scraping page ${currentPage}:`, pageError);
    result.errors.push(`Error on page ${currentPage}: ${pageError}`);
  }
}

// Suara Kalbar scraping function with specific selectors and logic
async function scrapeSuaraKalbar(
  $: cheerio.CheerioAPI,
  baseUrl: string, 
  currentPage: number,
  maxPages: number, 
  delayMs: number,
  keywords: string[],
  result: ScrapingResult,
  processedUrls: Set<string>,
  processedTitles: Set<string>,
  axiosConfig: any
): Promise<void> {
  try {
    console.log(`[SUARAKALBAR] Scraping page ${currentPage}: ${baseUrl}`);

    // Find articles using Suara Kalbar specific selectors
    const articleElements = $('.ray-main-post-title a, .post-title a, h2 a, h3 a').toArray();
    
    if (articleElements.length === 0) {
      console.log('[SUARAKALBAR] No articles found on page, trying alternative selectors...');
      const altElements = $('.post, .entry, article, a[href*=".co.id"]').toArray();
      if (altElements.length === 0) {
        console.log('[SUARAKALBAR] No articles found with any selector, stopping...');
        return;
      }
      articleElements.push(...altElements);
    }

    console.log(`✓ [SUARAKALBAR] Found ${articleElements.length} articles on page ${currentPage}`);

    // Step 1: Extract all articles and check keywords FIRST
    const relevantArticles: Array<{title: string, link: string, dateString: string, matchedKeywords: string[]}> = [];

    for (const articleElement of articleElements) {
      try {
        const $article = $(articleElement);
        
        // Extract title and link for Suara Kalbar
        let title: string, link: string;
        
        if ($article.is('a')) {
          title = cleanTextContent($article.text());
          link = $article.attr('href') || '';
        } else {
          const linkElement = $article.find('a').first();
          title = cleanTextContent($article.text());
          link = linkElement.attr('href') || '';
        }
        
        if (!title || !link || title.length < 10) {
          continue;
        }

        // Convert relative link to absolute
        const fullLink = link.startsWith('http') 
          ? link 
          : new URL(link, 'https://www.suarakalbar.co.id').href;

        // Step 2: Check if title matches any keywords BEFORE duplicate check
        const titleLower = title.toLowerCase();
        const matchedKeywords = keywords.filter(keyword => titleLower.includes(keyword));

        if (matchedKeywords.length === 0) {
          continue; // Skip if no keywords match - don't even process further
        }

        // Find date - Suara Kalbar specific (Indonesian long format)
        let dateString = '';
        // Look for date in nearby span or div elements
        const dateElement = $article.parent().find('span, .date, time').first();
        if (dateElement.length) {
          const dateText = dateElement.text().trim();
          // Check if this looks like a date
          if (dateText.match(/(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|sep|okt|nov|des)\s+(\d{4})/i) ||
              dateText.match(/(senin|selasa|rabu|kamis|jumat|sabtu|minggu)/i)) {
            dateString = dateText;
          }
        }
        
        // If no date found, look in article container
        if (!dateString) {
          const nearbyDate = $article.closest('div, article').find('span, .date, time').first();
          if (nearbyDate.length) {
            const dateText = nearbyDate.text().trim();
            if (dateText.match(/(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)/i)) {
              dateString = dateText;
            }
          }
        }

        // Add to relevant articles for processing
        relevantArticles.push({
          title,
          link: fullLink,
          dateString,
          matchedKeywords
        });

      } catch (articleError) {
        console.error('[SUARAKALBAR] Error extracting article info:', articleError);
        continue;
      }
    }

    console.log(`📊 [SUARAKALBAR] From ${articleElements.length} articles on page ${currentPage}, found ${relevantArticles.length} articles matching keywords`);

    // Step 3: Process relevant articles (check duplicates, fetch content, save)
    for (const article of relevantArticles) {
      try {
        console.log(`🔍 [SUARAKALBAR] Processing: "${article.title.substring(0, 60)}..." (Keywords: ${article.matchedKeywords.join(', ')})`);

        // Check for duplicates AFTER keyword filtering
        if (await checkDuplicateArticle(article.title, article.link, processedUrls, processedTitles)) {
          console.log(`⚠️ [SUARAKALBAR] Duplicate found, skipping: "${article.title.substring(0, 40)}..."`);
          result.duplicates++;
          continue;
        }

        // Parse date with our enhanced function
        const parsedDate = parseIndonesianDate(article.dateString);

        // Fetch full article content
        let content = '';
        try {
          console.log(`📥 [SUARAKALBAR] Fetching content from: ${article.link}`);
          await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
          
          const articleResponse = await axios.get(article.link, axiosConfig);
          const $articlePage = cheerio.load(articleResponse.data);
          
          // Suara Kalbar content selectors
          const contentSelectors = [
            '.entry-content',
            '.post-content',
            '.article-content',
            '.content',
            'main p',
            '.single-content p'
          ];
          
          for (const selector of contentSelectors) {
            const contentElement = $articlePage(selector).first();
            if (contentElement.length) {
              content = cleanTextContent(contentElement.text());
              if (content.length > 100) {
                console.log(`✅ [SUARAKALBAR] Content extracted using selector: ${selector} (${content.length} chars)`);
                break;
              }
            }
          }
          
          if (!content) {
            content = cleanTextContent($articlePage('p').text());
            console.log(`⚠️ [SUARAKALBAR] Using fallback paragraph content (${content.length} chars)`);
          }
          
        } catch (contentError) {
          console.warn(`❌ [SUARAKALBAR] Failed to fetch content for ${article.link}:`, contentError);
          content = article.title; // Use title as fallback content
        }

        // Create news item
        const newsItem: ScrapedNewsItem = {
          title: article.title,
          content: content || article.title,
          link: article.link,
          date: parsedDate,
          portal: baseUrl,
          matchedKeywords: article.matchedKeywords,
        };

        // Save to database
        try {
          await saveScrapedArticle({
            idBerita: crypto.randomUUID(),
            portalBerita: baseUrl,
            linkBerita: article.link,
            judul: article.title,
            isi: content || article.title,
            tanggalBerita: parsedDate,
            matchedKeywords: article.matchedKeywords,
          });
          
          // Update keyword match counts
          const activeKeywords = await getActiveKeywords();
          for (const keyword of article.matchedKeywords) {
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
          
          console.log(`✅ [SUARAKALBAR] Successfully scraped: "${article.title.substring(0, 50)}..." (Keywords: ${article.matchedKeywords.join(', ')})`);
          
        } catch (saveError) {
          console.error('❌ [SUARAKALBAR] Error saving article:', saveError);
          result.errors.push(`Failed to save article: ${article.title}`);
        }

      } catch (articleError) {
        console.error('❌ [SUARAKALBAR] Error processing relevant article:', articleError);
        result.errors.push(`Error processing article: ${article.title}`);
      }
    }

    result.totalScraped += articleElements.length;
    console.log(`📈 [SUARAKALBAR] Page ${currentPage} summary: ${articleElements.length} total articles, ${relevantArticles.length} keyword matches, ${result.newItems} saved, ${result.duplicates} duplicates`);

  } catch (pageError) {
    console.error(`❌ [SUARAKALBAR] Error scraping page ${currentPage}:`, pageError);
    result.errors.push(`Error on page ${currentPage}: ${pageError}`);
  }
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

    // Route to portal-specific scraping functions (Pontianak Post uses Chromium, so skip it here)
    if (portalUrl.includes('pontianakpost')) {
      throw new Error('Pontianak Post should use Chromium scraping, not Axios. Please select the Chromium scraping engine.');
    }

    for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
      try {
        console.log(`[AXIOS] Scraping page ${currentPage}...`);
        
        // Construct page URL with portal-specific logic
        let pageUrl: string;
        if (portalUrl.includes('antaranews')) {
          // Antara News pagination: kalbar/{page-number}
          pageUrl = currentPage === 1 ? portalUrl : `${portalUrl}/${currentPage}`;
        } else if (portalUrl.includes('kalbaronline')) {
          // Kalbar Online pagination: /page/{page-number}
          pageUrl = currentPage === 1 ? portalUrl : `${portalUrl}/page/${currentPage}`;
        } else if (portalUrl.includes('suarakalbar')) {
          // Suara Kalbar pagination: /page/{page-number}
          pageUrl = currentPage === 1 ? portalUrl : `${portalUrl}/page/${currentPage}`;
        } else {
          // Generic pagination
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
        
        // Route to specific portal scraping function
        if (portalUrl.includes('antaranews')) {
          await scrapeAntaranews($, portalUrl, currentPage, maxPages, delayMs, keywordList, result, processedUrls, processedTitles, axiosConfig);
        } else if (portalUrl.includes('kalbaronline')) {
          await scrapeKalbarOnline($, portalUrl, currentPage, maxPages, delayMs, keywordList, result, processedUrls, processedTitles, axiosConfig);
        } else if (portalUrl.includes('suarakalbar')) {
          await scrapeSuaraKalbar($, portalUrl, currentPage, maxPages, delayMs, keywordList, result, processedUrls, processedTitles, axiosConfig);
        } else {
          console.warn(`[AXIOS] Unknown portal: ${portalUrl}, skipping...`);
          break;
        }

        // Add delay between pages
        if (currentPage < maxPages && delayMs > 0) {
          console.log(`[AXIOS] Waiting ${delayMs}ms before next page...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

      } catch (pageError) {
        console.error(`[AXIOS] Error scraping page ${currentPage}:`, pageError);
        result.errors.push(`Error on page ${currentPage}: ${pageError}`);
        
        // Continue with next page instead of breaking
        continue;
      }
    }

    result.success = true;
    console.log(`[AXIOS] Scraping completed. Total: ${result.totalScraped}, New: ${result.newItems}, Duplicates: ${result.duplicates}`);

  } catch (error) {
    console.error('[AXIOS] Scraping failed:', error);
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