// Test script untuk debug XPath extraction tanggal publish Kalbar Antaranews
const { scrapeKalbarAntaranewsWithChromium } = require('./src/lib/chromium-scraping-service.ts');

async function testXPathDebug() {
  console.log('🚀 Starting XPath debug test for Kalbar Antaranews...');
  
  try {
    const options = {
      portalUrl: 'https://kalbar.antaranews.com/kalbar',
      maxPages: 1, // Hanya test 1 halaman
      keywords: ['test'], // Dummy keyword agar tidak filter artikel
      delayMs: 1000
    };
    
    console.log('📄 Testing with options:', options);
    
    // Jalankan scraping (fungsi debug akan otomatis dipanggil)
    const result = await scrapeKalbarAntaranewsWithChromium(options);
    
    console.log('✅ Debug test completed!');
    console.log('📊 Result summary:');
    console.log(`   - Success: ${result.success}`);
    console.log(`   - Total scraped: ${result.totalScraped}`);
    console.log(`   - New items: ${result.newItems}`);
    console.log(`   - Duplicates: ${result.duplicates}`);
    console.log(`   - Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('❌ Errors encountered:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
  
  console.log('🏁 Test script finished.');
  process.exit(0);
}

// Jalankan test
testXPathDebug();