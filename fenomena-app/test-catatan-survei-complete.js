// Test all catatan-survei endpoints that have been fixed

async function testAllEndpoints() {
  const baseUrl = 'http://localhost:3000';
  
  try {
    console.log('🧪 Testing all catatan-survei endpoints...\n');

    // Step 1: Login
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@fenomena.com',
        password: 'admin123'
      })
    });

    const setCookieHeader = loginResponse.headers.get('set-cookie');
    const cookieMatch = setCookieHeader?.match(/auth-token=([^;]+)/);
    const authToken = cookieMatch[1];
    const authCookie = `auth-token=${authToken}`;

    console.log('✅ Login successful\n');

    // Test endpoints
    const endpoints = [
      {
        name: 'GET /api/profile',
        url: '/api/profile',
        method: 'GET'
      },
      {
        name: 'GET /api/categories',
        url: '/api/categories',
        method: 'GET'
      },
      {
        name: 'GET /api/catatan-survei',
        url: '/api/catatan-survei?page=1&limit=5',
        method: 'GET'
      },
      {
        name: 'POST /api/catatan-survei/check-existing',
        url: '/api/catatan-survei/check-existing',
        method: 'POST',
        body: { categoryId: 'cmdwkmn290000ezmknanhx39h' } // SUPAS25 category ID
      }
    ];

    let allPassed = true;

    for (const endpoint of endpoints) {
      try {
        console.log(`🧪 Testing ${endpoint.name}...`);
        
        const options = {
          method: endpoint.method,
          headers: {
            'Cookie': authCookie,
            'Content-Type': 'application/json'
          }
        };

        if (endpoint.body) {
          options.body = JSON.stringify(endpoint.body);
        }

        const response = await fetch(`${baseUrl}${endpoint.url}`, options);
        
        if (response.ok) {
          console.log(`   ✅ ${endpoint.name}: ${response.status} OK`);
          
          // Show some details for main data endpoint
          if (endpoint.url.includes('/api/catatan-survei?')) {
            const data = await response.json();
            console.log(`   📊 Data: ${data.data?.length} records, Total: ${data.pagination?.totalCount}`);
          }
        } else {
          console.log(`   ❌ ${endpoint.name}: ${response.status} FAILED`);
          const errorText = await response.text();
          console.log(`   Error: ${errorText.substring(0, 100)}`);
          allPassed = false;
        }
      } catch (error) {
        console.log(`   ❌ ${endpoint.name}: ERROR - ${error.message}`);
        allPassed = false;
      }
    }

    console.log(`\n${allPassed ? '🎉' : '❌'} Overall result: ${allPassed ? 'ALL ENDPOINTS WORKING' : 'SOME ENDPOINTS FAILED'}`);

    if (allPassed) {
      console.log('\n💡 All main APIs are working. If browser still shows error:');
      console.log('   1. Hard refresh: Ctrl+Shift+R');
      console.log('   2. Clear browser cache completely');
      console.log('   3. Try incognito/private browsing');
      console.log('   4. Check browser console for specific JS errors');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAllEndpoints().catch(console.error);