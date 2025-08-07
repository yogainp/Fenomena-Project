// Using built-in fetch (Node.js 18+)

async function testCatatanSurveiAPI() {
  const baseUrl = 'http://localhost:3000';
  
  try {
    // Step 1: Login sebagai admin
    console.log('🔑 Step 1: Login as admin...');
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
    console.log('✅ Login successful');

    // Step 2: Test GET catatan-survei
    console.log('\n🧪 Step 2: Test GET /api/catatan-survei...');
    const getResponse = await fetch(`${baseUrl}/api/catatan-survei?page=1&limit=5`, {
      headers: {
        'Cookie': `auth-token=${authToken}`
      }
    });

    console.log(`GET Status: ${getResponse.status}`);
    
    if (getResponse.ok) {
      const getData = await getResponse.json();
      console.log('✅ GET catatan-survei Success');
      console.log(`📊 Data Structure:`);
      console.log(`   - Total records: ${getData.pagination?.totalCount}`);
      console.log(`   - Current page: ${getData.pagination?.page}`);
      console.log(`   - Data length: ${getData.data?.length}`);
      
      if (getData.data && getData.data.length > 0) {
        console.log(`   - Sample record:`, {
          id: getData.data[0].id,
          catatan: getData.data[0].catatan?.substring(0, 50) + '...',
          nomorResponden: getData.data[0].nomorResponden,
          region: getData.data[0].region?.city,
          category: getData.data[0].category?.name
        });
      }
    } else {
      const errorText = await getResponse.text();
      console.error('❌ GET failed:', errorText.substring(0, 200));
    }

    // Step 3: Test dengan filter
    console.log('\n🧪 Step 3: Test GET dengan search filter...');
    const searchResponse = await fetch(`${baseUrl}/api/catatan-survei?page=1&limit=5&search=test`, {
      headers: {
        'Cookie': `auth-token=${authToken}`
      }
    });

    console.log(`Search Status: ${searchResponse.status}`);
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      console.log('✅ Search filter works');
      console.log(`📊 Search results: ${searchData.data?.length} records`);
    } else {
      const errorText = await searchResponse.text();
      console.error('❌ Search failed:', errorText.substring(0, 100));
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCatatanSurveiAPI().catch(console.error);