// Using built-in fetch (Node.js 18+)

async function testAnalyticsFrontendFlow() {
  const baseUrl = 'http://localhost:3000';
  
  try {
    // Step 1: Login
    console.log('🔑 Step 1: Login...');
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: 'admin@fenomena.com',
        password: 'admin123'
      })
    });

    console.log(`Login Status: ${loginResponse.status}`);
    
    if (!loginResponse.ok) {
      console.error('❌ Login failed');
      return;
    }

    // Get cookie header
    const setCookieHeader = loginResponse.headers.get('set-cookie');
    const authCookie = setCookieHeader || '';
    console.log('✅ Login successful, cookie obtained');

    // Step 2: Test analytics overview (same as frontend)
    console.log('\n🧪 Step 2: Test analytics overview endpoint...');
    const overviewResponse = await fetch(`${baseUrl}/api/analytics/overview`, {
      credentials: 'include',
      headers: {
        'Cookie': authCookie
      }
    });

    console.log(`Overview Status: ${overviewResponse.status}`);
    
    if (overviewResponse.ok) {
      const overviewData = await overviewResponse.json();
      console.log('✅ Overview API Success');
      console.log('📊 Overview Data Structure:');
      console.log(`   - overview.totalPhenomena: ${overviewData.overview?.totalPhenomena}`);
      console.log(`   - categoryAnalysis length: ${overviewData.categoryAnalysis?.length}`);
      console.log(`   - userContributions length: ${overviewData.userContributions?.length}`);
    } else {
      const errorText = await overviewResponse.text();
      console.error('❌ Overview failed:', errorText.substring(0, 200));
    }

    // Step 3: Test analytics text-analysis (same as frontend)
    console.log('\n🧪 Step 3: Test analytics text-analysis endpoint...');
    const textResponse = await fetch(`${baseUrl}/api/analytics/text-analysis`, {
      credentials: 'include',
      headers: {
        'Cookie': authCookie
      }
    });

    console.log(`Text Analysis Status: ${textResponse.status}`);
    
    if (textResponse.ok) {
      const textData = await textResponse.json();
      console.log('✅ Text Analysis API Success');
      console.log('📝 Text Analysis Data Structure:');
      console.log(`   - totalPhenomena: ${textData.totalPhenomena}`);
      console.log(`   - topKeywords length: ${textData.topKeywords?.length}`);
      console.log(`   - sentimentAnalysis length: ${textData.sentimentAnalysis?.length}`);
    } else {
      const errorText = await textResponse.text();
      console.error('❌ Text Analysis failed:', errorText.substring(0, 200));
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAnalyticsFrontendFlow().catch(console.error);