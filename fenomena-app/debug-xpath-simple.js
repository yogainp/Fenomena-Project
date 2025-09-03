// Script sederhana untuk debug XPath tanggal publish
const puppeteer = require('puppeteer');

async function debugXPathSimple() {
  console.log('🚀 Starting simple XPath debug test...');
  
  let browser;
  try {
    // Launch browser
    console.log('📱 Launching browser...');
    browser = await puppeteer.launch({
      headless: false, // Non-headless agar bisa lihat
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
      defaultViewport: { width: 1024, height: 768 },
    });
    
    const page = await browser.newPage();
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to Kalbar Antaranews
    const url = 'https://kalbar.antaranews.com/kalbar';
    console.log(`🌐 Navigating to: ${url}`);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    // Wait for content to load
    console.log('⏳ Waiting for content to load...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Run debug XPath extraction
    console.log('🔍 Running XPath debug extraction...');
    
    const debugResults = await page.evaluate(() => {
      console.log('=== STARTING DEBUG IN BROWSER ===');
      const results = [];
      
      // Test untuk 5 artikel pertama
      for (let i = 1; i <= 5; i++) {
        console.log(`\n--- Testing Article ${i} ---`);
        
        const articleResult = {
          articleIndex: i,
          found: false,
          methods: {},
          articleExists: false
        };
        
        // Method 1: Cek apakah artikel exists
        try {
          const articleXPath = `//div[@id='main-container']/div[2]/div/div[1]/article[${i}]`;
          const articleNode = document.evaluate(articleXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          
          if (articleNode.singleNodeValue) {
            articleResult.articleExists = true;
            const article = articleNode.singleNodeValue;
            
            console.log(`Article ${i}: EXISTS`);
            console.log(`Article ${i} HTML preview:`, article.innerHTML.substring(0, 200) + '...');
            
            // Cek header
            const header = article.querySelector('header');
            if (header) {
              console.log(`Article ${i} header HTML:`, header.innerHTML.substring(0, 300) + '...');
              
              // Method 2: Test XPath ke span/text()
              const spanXPath = `//div[@id='main-container']/div[2]/div/div[1]/article[${i}]/header/p/span/text()`;
              const spanTextResult = document.evaluate(spanXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
              
              if (spanTextResult.singleNodeValue) {
                const dateText = spanTextResult.singleNodeValue.textContent?.trim();
                console.log(`Article ${i} XPath text(): "${dateText}"`);
                articleResult.methods.xpathText = {
                  success: true,
                  value: dateText
                };
                if (dateText) articleResult.found = true;
              } else {
                console.log(`Article ${i} XPath text(): NO RESULT`);
                articleResult.methods.xpathText = { success: false };
              }
              
              // Method 3: Test XPath ke span element
              const spanElemXPath = `//div[@id='main-container']/div[2]/div/div[1]/article[${i}]/header/p/span`;
              const spanElemResult = document.evaluate(spanElemXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
              
              if (spanElemResult.singleNodeValue) {
                const spanElement = spanElemResult.singleNodeValue;
                const textContent = spanElement.textContent?.trim();
                const innerHTML = spanElement.innerHTML;
                
                console.log(`Article ${i} span element textContent: "${textContent}"`);
                console.log(`Article ${i} span element innerHTML: "${innerHTML}"`);
                
                articleResult.methods.xpathSpan = {
                  success: true,
                  textContent: textContent,
                  innerHTML: innerHTML
                };
                
                if (textContent && !articleResult.found) {
                  articleResult.found = true;
                }
              } else {
                console.log(`Article ${i} span element: NO RESULT`);
                articleResult.methods.xpathSpan = { success: false };
              }
              
              // Method 4: CSS Selector fallback
              const cssSelector = 'header > p > span';
              const cssSelectorResult = article.querySelector(cssSelector);
              if (cssSelectorResult) {
                const cssText = cssSelectorResult.textContent?.trim();
                console.log(`Article ${i} CSS selector result: "${cssText}"`);
                articleResult.methods.cssSelector = {
                  success: true,
                  textContent: cssText
                };
                if (cssText && !articleResult.found) {
                  articleResult.found = true;
                }
              } else {
                console.log(`Article ${i} CSS selector: NO RESULT`);
                articleResult.methods.cssSelector = { success: false };
              }
              
            } else {
              console.log(`Article ${i}: NO HEADER`);
              articleResult.headerExists = false;
            }
          } else {
            console.log(`Article ${i}: ARTICLE NOT FOUND`);
            articleResult.articleExists = false;
          }
        } catch (error) {
          console.log(`Article ${i} ERROR:`, error.message);
          articleResult.error = error.message;
        }
        
        results.push(articleResult);
      }
      
      // Summary
      const foundCount = results.filter(r => r.found).length;
      const existCount = results.filter(r => r.articleExists).length;
      
      console.log(`\n=== SUMMARY ===`);
      console.log(`Articles exist: ${existCount}/5`);
      console.log(`Dates found: ${foundCount}/5`);
      
      return {
        articleResults: results,
        summary: {
          articlesExist: existCount,
          datesFound: foundCount,
          totalTested: 5
        }
      };
    });
    
    // Output results
    console.log('\n🎯 DEBUG RESULTS:');
    console.log('==================');
    
    debugResults.articleResults.forEach((result, index) => {
      console.log(`\nArticle ${index + 1}:`);
      console.log(`  Exists: ${result.articleExists}`);
      console.log(`  Date Found: ${result.found}`);
      
      if (result.methods.xpathText) {
        console.log(`  XPath text(): ${result.methods.xpathText.success ? `"${result.methods.xpathText.value}"` : 'FAILED'}`);
      }
      
      if (result.methods.xpathSpan) {
        console.log(`  XPath span: ${result.methods.xpathSpan.success ? `"${result.methods.xpathSpan.textContent}"` : 'FAILED'}`);
      }
      
      if (result.methods.cssSelector) {
        console.log(`  CSS selector: ${result.methods.cssSelector.success ? `"${result.methods.cssSelector.textContent}"` : 'FAILED'}`);
      }
    });
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Articles found: ${debugResults.summary.articlesExist}/${debugResults.summary.totalTested}`);
    console.log(`   Dates extracted: ${debugResults.summary.datesFound}/${debugResults.summary.totalTested}`);
    
    // Keep browser open for 10 seconds to inspect
    console.log('\n👀 Keeping browser open for 10 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('❌ Debug test failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  
  console.log('🏁 Debug test completed!');
}

// Jalankan debug
debugXPathSimple();