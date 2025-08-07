// Using built-in fetch (Node.js 18+)

async function testApiEndpoints() {
  const baseUrl = 'http://localhost:3000';
  
  // First, get auth token
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
    { name: 'Catalog/Berita', url: '/api/katalog-berita' },
    { name: 'Phenomena', url: '/api/phenomena' },
    { name: 'Categories', url: '/api/categories' },
    { name: 'Regions', url: '/api/regions' }
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
        console.log(`   ✅ Success - Data length: ${Array.isArray(data) ? data.length : (data.phenomena?.length || 'N/A')}`);
      } else {
        const errorText = await response.text();
        console.log(`   ❌ Failed - ${errorText.substring(0, 100)}`);
      }
    } catch (error) {
      console.log(`   ❌ Error - ${error.message}`);
    }
  }
}

testApiEndpoints().catch(console.error);