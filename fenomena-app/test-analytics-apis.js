// Using built-in fetch (Node.js 18+)

async function testAnalyticsApis() {
  const baseUrl = 'http://localhost:3000';
  
  // Get auth token
  console.log('🔑 Getting auth token...');
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
  if (!cookieMatch) {
    console.error('❌ No auth token found');
    return;
  }

  const authToken = cookieMatch[1];
  console.log('✅ Auth token obtained');

  const endpoints = [
    { name: 'Analytics Overview', url: '/api/analytics/overview' },
    { name: 'Analytics Text Analysis', url: '/api/analytics/text-analysis' }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\n🧪 Testing ${endpoint.name}...`);
      
      const response = await fetch(`${baseUrl}${endpoint.url}`, {
        headers: {
          'Cookie': `auth-token=${authToken}`
        }
      });

      console.log(`   Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ Success`);
        
        if (endpoint.name === 'Analytics Overview') {
          console.log(`   📊 Overview Data:`);
          console.log(`      - Total Phenomena: ${data.overview?.totalPhenomena}`);
          console.log(`      - Total Categories: ${data.overview?.totalCategories}`);
          console.log(`      - Category Analysis: ${data.categoryAnalysis?.length} items`);
          console.log(`      - User Contributions: ${data.userContributions?.length} users`);
        } else if (endpoint.name === 'Analytics Text Analysis') {
          console.log(`   📝 Text Analysis Data:`);
          console.log(`      - Total Phenomena Analyzed: ${data.totalPhenomena}`);
          console.log(`      - Top Keywords: ${data.topKeywords?.length} items`);
          console.log(`      - Word Cloud Data: ${data.wordCloudData?.length} words`);
          console.log(`      - Total Unique Words: ${data.totalUniqueWords}`);
        }
      } else {
        const errorText = await response.text();
        console.log(`   ❌ Failed - ${errorText.substring(0, 200)}`);
      }
    } catch (error) {
      console.log(`   ❌ Error - ${error.message}`);
    }
  }
}

testAnalyticsApis().catch(console.error);