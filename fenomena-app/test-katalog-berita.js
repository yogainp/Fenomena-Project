// Test katalog berita API
async function testKatalogBeritaAPI() {
  const baseUrl = 'http://localhost:3000';
  
  try {
    console.log('🧪 Testing katalog berita API...\n');

    // Step 1: Login
    console.log('1. 🔑 Login...');
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@fenomena.com',
        password: 'admin123'
      })
    });

    if (!loginResponse.ok) {
      console.error('❌ Login failed');
      return;
    }

    const setCookieHeader = loginResponse.headers.get('set-cookie');
    const cookieMatch = setCookieHeader?.match(/auth-token=([^;]+)/);
    const authToken = cookieMatch[1];
    const authCookie = `auth-token=${authToken}`;
    console.log('✅ Login successful');

    // Step 2: Test katalog berita API
    console.log('\n2. 📰 Test katalog berita API...');
    
    const katalogResponse = await fetch(`${baseUrl}/api/katalog-berita?page=1&limit=5`, {
      headers: { 'Cookie': authCookie }
    });

    console.log(`Katalog API Status: ${katalogResponse.status}`);
    
    if (katalogResponse.ok) {
      const katalogData = await katalogResponse.json();
      console.log('✅ Katalog berita API working');
      console.log(`📊 Data Summary:`);
      console.log(`   - Total berita: ${katalogData.pagination?.totalBerita}`);
      console.log(`   - Current page data: ${katalogData.berita?.length} items`);
      
      // Check for null matchedKeywords
      let nullKeywordsCount = 0;
      let validKeywordsCount = 0;
      
      katalogData.berita?.forEach((berita) => {
        if (berita.matchedKeywords === null) {
          nullKeywordsCount++;
        } else if (Array.isArray(berita.matchedKeywords)) {
          validKeywordsCount++;
        }
      });
      
      console.log(`   - Null matchedKeywords: ${nullKeywordsCount}`);
      console.log(`   - Valid matchedKeywords: ${validKeywordsCount}`);
      
      if (nullKeywordsCount > 0) {
        console.log('⚠️  Found null matchedKeywords - frontend should handle this properly');
      }
      
    } else {
      const errorText = await katalogResponse.text();
      console.error('❌ Katalog berita API failed:', errorText.substring(0, 300));
      return;
    }

    console.log('\n🎉 Katalog berita API test completed!');
    console.log('\n💡 Frontend should now handle null matchedKeywords correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testKatalogBeritaAPI().catch(console.error);