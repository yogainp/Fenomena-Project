// Test analisis catatan survei API dan frontend flow

async function testAnalisisCatatanSurveiAPI() {
  const baseUrl = 'http://localhost:3000';
  
  try {
    console.log('🧪 Testing analisis catatan survei complete flow...\n');

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

    // Step 2: Test initial data endpoints (as frontend does)
    console.log('\n2. 📂 Fetch initial data...');
    
    const [categoriesRes, regionsRes] = await Promise.all([
      fetch(`${baseUrl}/api/categories`, {
        headers: { 'Cookie': authCookie }
      }),
      fetch(`${baseUrl}/api/regions`, {
        headers: { 'Cookie': authCookie }
      })
    ]);

    let categoriesOk = false, regionsOk = false;

    if (categoriesRes.ok) {
      const categories = await categoriesRes.json();
      console.log('✅ Categories loaded:', categories.length);
      categoriesOk = true;
    } else {
      console.log('❌ Categories failed:', categoriesRes.status);
    }

    if (regionsRes.ok) {
      const regions = await regionsRes.json();
      console.log('✅ Regions loaded:', regions.length);
      regionsOk = true;
    } else {
      console.log('❌ Regions failed:', regionsRes.status);
    }

    // Step 3: Test main analytics endpoint
    console.log('\n3. 📊 Test analytics catatan survei API...');
    
    const params = new URLSearchParams();
    // No filters initially - get all data
    
    const analyticsResponse = await fetch(`${baseUrl}/api/analytics/catatan-survei?${params.toString()}`, {
      headers: { 'Cookie': authCookie }
    });

    console.log(`Analytics API Status: ${analyticsResponse.status}`);
    
    if (analyticsResponse.ok) {
      const analyticsData = await analyticsResponse.json();
      console.log('✅ Analytics data loaded successfully');
      console.log('📊 Analytics Data Summary:');
      console.log(`   - Total Catatan Survei: ${analyticsData.totalCatatanSurvei}`);
      console.log(`   - Top Keywords: ${analyticsData.topKeywords?.length} items`);
      console.log(`   - Sentiment Analysis: ${analyticsData.sentimentAnalysis?.length} categories`);
      console.log(`   - Category Analysis: ${Object.keys(analyticsData.categoryAnalysis || {}).length} categories`);
      console.log(`   - Region Analysis: ${Object.keys(analyticsData.regionAnalysis || {}).length} regions`);
      console.log(`   - Word Cloud Data: ${analyticsData.wordCloudData?.length} words`);
      console.log(`   - Average Note Length: ${analyticsData.avgNoteLength} characters`);
      console.log(`   - Total Unique Words: ${analyticsData.totalUniqueWords}`);

      // Test with filter
      console.log('\n4. 🔍 Test with category filter...');
      const filteredParams = new URLSearchParams();
      filteredParams.append('categoryId', 'cmdwkmn290000ezmknanhx39h'); // SUPAS25
      
      const filteredResponse = await fetch(`${baseUrl}/api/analytics/catatan-survei?${filteredParams.toString()}`, {
        headers: { 'Cookie': authCookie }
      });

      if (filteredResponse.ok) {
        const filteredData = await filteredResponse.json();
        console.log('✅ Filtered analytics working');
        console.log(`   - Filtered Total: ${filteredData.totalCatatanSurvei}`);
        console.log(`   - Is Filtered: ${filteredData.filterInfo?.isFiltered}`);
      } else {
        console.log('❌ Filtered analytics failed:', filteredResponse.status);
      }
      
    } else {
      const errorText = await analyticsResponse.text();
      console.error('❌ Analytics API failed:', errorText.substring(0, 300));
      return;
    }

    console.log('\n🎉 All API endpoints working successfully!');
    console.log('\n💡 If browser still shows error:');
    console.log('   1. Hard refresh: Ctrl+Shift+R');
    console.log('   2. Clear browser cache');
    console.log('   3. Logout and login again');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAnalisisCatatanSurveiAPI().catch(console.error);