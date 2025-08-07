// Script to generate valid cookie for browser testing

async function generateValidCookie() {
  const baseUrl = 'http://localhost:3000';
  
  try {
    console.log('🔑 Getting fresh auth token for browser testing...');
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
    console.log('✅ Fresh auth token generated');
    console.log(`📋 Copy this cookie for browser DevTools:`);
    console.log(`   auth-token=${authToken}`);
    
    // Test both endpoints quickly
    console.log('\n🧪 Testing both analytics endpoints with fresh token...');
    
    const [overviewRes, textRes] = await Promise.all([
      fetch(`${baseUrl}/api/analytics/overview`, {
        headers: { 'Cookie': `auth-token=${authToken}` }
      }),
      fetch(`${baseUrl}/api/analytics/text-analysis`, {
        headers: { 'Cookie': `auth-token=${authToken}` }
      })
    ]);

    console.log(`📊 Overview API: ${overviewRes.status} ${overviewRes.ok ? '✅' : '❌'}`);
    console.log(`📝 Text Analysis API: ${textRes.status} ${textRes.ok ? '✅' : '❌'}`);

    if (overviewRes.ok && textRes.ok) {
      console.log('\n🎉 Both APIs working! The issue might be browser-specific.');
      console.log('💡 Try:');
      console.log('   1. Hard refresh (Ctrl+Shift+R)');
      console.log('   2. Clear browser cache');
      console.log('   3. Check Network tab in DevTools for actual requests');
    } else {
      if (!overviewRes.ok) {
        const overviewError = await overviewRes.text();
        console.error('❌ Overview error:', overviewError);
      }
      if (!textRes.ok) {
        const textError = await textRes.text();
        console.error('❌ Text analysis error:', textError);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

generateValidCookie().catch(console.error);