// Using built-in fetch (Node.js 18+)

async function testLoginFlow() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 Testing complete login flow...');

  try {
    // Test login request
    console.log('1. 📤 Sending login request...');
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@fenomena.com',
        password: 'admin123'
      })
    });

    console.log(`   Status: ${loginResponse.status}`);
    console.log(`   Status Text: ${loginResponse.statusText}`);
    
    const loginData = await loginResponse.json();
    console.log(`   Response:`, loginData);

    // Check for Set-Cookie header
    const setCookieHeader = loginResponse.headers.get('set-cookie');
    console.log(`   Set-Cookie Header:`, setCookieHeader);

    if (!setCookieHeader) {
      console.log('❌ No Set-Cookie header found!');
      return;
    }

    // Extract cookie value
    const cookieMatch = setCookieHeader.match(/auth-token=([^;]+)/);
    if (!cookieMatch) {
      console.log('❌ No auth-token found in cookies!');
      return;
    }

    const authToken = cookieMatch[1];
    console.log(`   🍪 Auth Token: ${authToken.substring(0, 50)}...`);

    // Test profile request with cookie
    console.log('\n2. 📤 Testing profile request with cookie...');
    const profileResponse = await fetch(`${baseUrl}/api/profile`, {
      headers: {
        'Cookie': `auth-token=${authToken}`
      }
    });

    console.log(`   Status: ${profileResponse.status}`);
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      console.log(`   Profile:`, profileData);
      console.log('✅ Cookie flow working correctly!');
    } else {
      const errorData = await profileResponse.text();
      console.log(`   Error:`, errorData);
      console.log('❌ Cookie flow failed!');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testLoginFlow();