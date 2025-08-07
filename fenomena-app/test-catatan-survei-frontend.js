// Simulate exact frontend flow for catatan-survei page

async function testFrontendFlow() {
  const baseUrl = 'http://localhost:3000';
  
  try {
    console.log('🧪 Testing exact frontend flow for catatan-survei page...\n');

    // Step 1: Login
    console.log('1. 🔑 Login...');
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
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
    const authCookie = setCookieHeader || '';
    console.log('✅ Login successful');

    // Step 2: Check user profile (as frontend does)
    console.log('\n2. 👤 Check user profile...');
    const profileResponse = await fetch(`${baseUrl}/api/profile`, {
      credentials: 'include',
      headers: { 'Cookie': authCookie }
    });

    console.log(`Profile Status: ${profileResponse.status}`);
    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      console.log('✅ Profile loaded');
      console.log(`   Role: ${profile.role}`);
      console.log(`   Username: ${profile.username}`);
      
      if (profile.role !== 'ADMIN') {
        console.log('❌ User is not admin, access would be denied');
        return;
      }
    } else {
      console.error('❌ Profile fetch failed');
      const errorText = await profileResponse.text();
      console.log('Error:', errorText.substring(0, 200));
      return;
    }

    // Step 3: Fetch categories (as frontend does in fetchInitialData)
    console.log('\n3. 📂 Fetch categories...');
    const categoriesResponse = await fetch(`${baseUrl}/api/categories`, {
      credentials: 'include',
      headers: { 'Cookie': authCookie }
    });

    console.log(`Categories Status: ${categoriesResponse.status}`);
    if (categoriesResponse.ok) {
      const categories = await categoriesResponse.json();
      console.log('✅ Categories loaded');
      console.log(`   Categories count: ${categories.length}`);
      if (categories.length > 0) {
        console.log(`   Sample: ${categories[0].name}`);
      }
    } else {
      console.error('❌ Categories fetch failed');
    }

    // Step 4: Fetch catatan-survei data (main data)
    console.log('\n4. 📊 Fetch catatan-survei data...');
    const params = new URLSearchParams({
      page: '1',
      limit: '10',
      search: '',
    });
    
    const dataResponse = await fetch(`${baseUrl}/api/catatan-survei?${params.toString()}`, {
      credentials: 'include',
      headers: { 'Cookie': authCookie }
    });

    console.log(`Data Status: ${dataResponse.status}`);
    if (dataResponse.ok) {
      const result = await dataResponse.json();
      console.log('✅ Catatan survei data loaded');
      console.log(`   Total records: ${result.pagination?.totalCount}`);
      console.log(`   Current page data: ${result.data?.length} records`);
      console.log(`   Total pages: ${result.pagination?.totalPages}`);
      
      if (result.data && result.data.length > 0) {
        const sample = result.data[0];
        console.log('   Sample record structure:', {
          id: sample.id,
          nomorResponden: sample.nomorResponden,
          hasRegion: !!sample.region,
          hasCategory: !!sample.category,
          hasUser: !!sample.user
        });
      }
    } else {
      console.error('❌ Catatan survei data fetch failed');
      const errorText = await dataResponse.text();
      console.log('Error:', errorText.substring(0, 300));
      return;
    }

    console.log('\n🎉 All frontend API calls successful!');
    console.log('💡 If page still shows internal server error:');
    console.log('   1. Hard refresh browser (Ctrl+Shift+R)');
    console.log('   2. Clear browser cache');
    console.log('   3. Check browser console for JS errors');
    console.log('   4. Try logout/login again');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFrontendFlow().catch(console.error);