const puppeteer = require('puppeteer');

async function debugKalbarAntaranews() {
  console.log('[DEBUG] Starting Kalbar Antaranews debugging...');
  
  let browser;
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: false, // Set to true if you don't want to see browser
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
      defaultViewport: { width: 1024, height: 768 },
    });

    const page = await browser.newPage();
    
    // Navigate to Kalbar Antaranews
    const url = 'https://kalbar.antaranews.com/kalbar';
    console.log(`[DEBUG] Navigating to: ${url}`);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });

    console.log('[DEBUG] Page loaded successfully');

    // Wait a bit for dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Extract articles using your XPath requirements
    const results = await page.evaluate(() => {
      console.log('[BROWSER] Starting extraction...');
      
      // Check if main container exists
      const mainContainer = document.querySelector('#main-container');
      if (!mainContainer) {
        return { error: 'main-container not found' };
      }
      
      console.log('[BROWSER] main-container found');
      
      // Get article container: //*[@id="main-container"]/div[2]/div/div[1]/article
      const articleContainer = document.querySelector('#main-container > div:nth-child(2) > div > div:nth-child(1)');
      if (!articleContainer) {
        return { error: 'Article container not found at #main-container > div:nth-child(2) > div > div:nth-child(1)' };
      }
      
      console.log('[BROWSER] Article container found');
      
      // Get all articles
      const articles = articleContainer.querySelectorAll('article');
      console.log(`[BROWSER] Found ${articles.length} articles`);
      
      if (articles.length === 0) {
        return { 
          error: 'No articles found', 
          containerHTML: articleContainer.innerHTML.substring(0, 1000) + '...'
        };
      }

      const results = [];
      
      // Test first 5 articles (or all if less than 5)
      const articlesToTest = Math.min(5, articles.length);
      
      for (let i = 0; i < articlesToTest; i++) {
        const article = articles[i];
        const articleNumber = i + 1;
        
        console.log(`[BROWSER] Processing article ${articleNumber}...`);
        
        const result = {
          articleNumber: articleNumber,
          title: null,
          titleFound: false,
          date: null,
          dateFound: false,
          link: null,
          errors: []
        };

        // Test title XPath: //*[@id="main-container"]/div[2]/div/div[1]/article[N]/header/h3/a
        try {
          const titleElement = article.querySelector('header h3 a');
          if (titleElement) {
            result.title = titleElement.textContent?.trim() || '';
            result.link = titleElement.getAttribute('href') || '';
            result.titleFound = true;
            console.log(`[BROWSER] Article ${articleNumber} title: "${result.title.substring(0, 50)}..."`);
          } else {
            result.errors.push('Title element not found at header > h3 > a');
            console.log(`[BROWSER] Article ${articleNumber}: Title element not found`);
            
            // Debug: Check what's in the header
            const header = article.querySelector('header');
            if (header) {
              result.errors.push(`Header HTML: ${header.innerHTML.substring(0, 200)}...`);
            } else {
              result.errors.push('No header element found');
            }
          }
        } catch (titleError) {
          result.errors.push(`Title extraction error: ${titleError.message}`);
        }

        // Test date XPath: //*[@id="main-container"]/div[2]/div/div[1]/article[N]/header/p/span/text()
        try {
          const dateElement = article.querySelector('header > p > span');
          if (dateElement) {
            result.date = dateElement.textContent?.trim() || '';
            result.dateFound = true;
            console.log(`[BROWSER] Article ${articleNumber} date: "${result.date}"`);
          } else {
            result.errors.push('Date element not found at header > p > span');
            console.log(`[BROWSER] Article ${articleNumber}: Date element not found`);
            
            // Debug: Check what's in header > p
            const headerP = article.querySelector('header > p');
            if (headerP) {
              result.errors.push(`Header P HTML: ${headerP.innerHTML}`);
              result.errors.push(`Header P text: ${headerP.textContent?.trim()}`);
            } else {
              result.errors.push('No header > p element found');
            }
          }
        } catch (dateError) {
          result.errors.push(`Date extraction error: ${dateError.message}`);
        }

        // Alternative date extraction methods
        if (!result.dateFound) {
          console.log(`[BROWSER] Article ${articleNumber}: Trying alternative date methods...`);
          
          // Try time element
          const timeElement = article.querySelector('time');
          if (timeElement) {
            const datetime = timeElement.getAttribute('datetime');
            const timeText = timeElement.textContent?.trim();
            result.errors.push(`Found time element - datetime: "${datetime}", text: "${timeText}"`);
          }
          
          // Try any element with date-like text
          const allSpans = article.querySelectorAll('span');
          for (let span of allSpans) {
            const spanText = span.textContent?.trim() || '';
            if (spanText.includes('lalu') || spanText.match(/\d+\s+(jam|menit|hari)\s+lalu/) || spanText.match(/\d+\s+\w+\s+\d{4}/)) {
              result.errors.push(`Potential date in span: "${spanText}"`);
            }
          }
        }

        results.push(result);
      }

      return {
        success: true,
        totalArticles: articles.length,
        testedArticles: articlesToTest,
        results: results,
        pageURL: window.location.href
      };
    });

    console.log('\n[DEBUG] ===== EXTRACTION RESULTS =====');
    console.log(`Total articles found: ${results.totalArticles || 'N/A'}`);
    console.log(`Articles tested: ${results.testedArticles || 'N/A'}`);
    
    if (results.error) {
      console.log(`ERROR: ${results.error}`);
      if (results.containerHTML) {
        console.log('Container HTML preview:', results.containerHTML);
      }
    } else if (results.results) {
      results.results.forEach((result, index) => {
        console.log(`\n--- Article ${result.articleNumber} ---`);
        console.log(`Title Found: ${result.titleFound}`);
        if (result.titleFound) {
          console.log(`Title: ${result.title}`);
          console.log(`Link: ${result.link}`);
        }
        console.log(`Date Found: ${result.dateFound}`);
        if (result.dateFound) {
          console.log(`Date: ${result.date}`);
        }
        if (result.errors.length > 0) {
          console.log('Errors/Debug info:');
          result.errors.forEach(error => console.log(`  - ${error}`));
        }
      });

      // Summary
      const titleSuccess = results.results.filter(r => r.titleFound).length;
      const dateSuccess = results.results.filter(r => r.dateFound).length;
      console.log('\n[DEBUG] ===== SUMMARY =====');
      console.log(`Titles extracted: ${titleSuccess}/${results.testedArticles}`);
      console.log(`Dates extracted: ${dateSuccess}/${results.testedArticles}`);
    }

  } catch (error) {
    console.error('[DEBUG] Error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the debug function
debugKalbarAntaranews().catch(console.error);