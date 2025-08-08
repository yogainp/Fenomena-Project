// Test script to verify upload functionality fix

async function testUploadFix() {
  const baseUrl = 'http://localhost:3000';
  
  try {
    console.log('🧪 Testing Upload Fix after Supabase Migration...\n');

    // Step 1: Login as admin
    console.log('1. 🔑 Login as admin...');
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
      console.error('❌ Login failed:', await loginResponse.text());
      return;
    }

    const setCookieHeader = loginResponse.headers.get('set-cookie');
    const authCookie = setCookieHeader || '';
    console.log('✅ Login successful');

    // Step 2: Get categories to find a valid categoryId
    console.log('\n2. 📂 Fetching categories...');
    const categoriesResponse = await fetch(`${baseUrl}/api/categories`, {
      credentials: 'include',
      headers: { 'Cookie': authCookie }
    });

    if (!categoriesResponse.ok) {
      console.error('❌ Categories fetch failed:', await categoriesResponse.text());
      return;
    }

    const categories = await categoriesResponse.json();
    console.log(`✅ Found ${categories.length} categories`);
    
    if (categories.length === 0) {
      console.log('❌ No categories found, cannot test upload');
      return;
    }

    const testCategoryId = categories[0].id;
    console.log(`🎯 Using category: ${categories[0].name} (ID: ${testCategoryId})`);

    // Step 3: Test check-existing endpoint
    console.log('\n3. 🔍 Testing check-existing endpoint...');
    const checkExistingResponse = await fetch(`${baseUrl}/api/catatan-survei/check-existing`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': authCookie 
      },
      credentials: 'include',
      body: JSON.stringify({
        categoryId: testCategoryId
      })
    });

    console.log(`Check-existing status: ${checkExistingResponse.status}`);
    if (checkExistingResponse.ok) {
      const existingInfo = await checkExistingResponse.json();
      console.log('✅ Check-existing works:', {
        hasExistingData: existingInfo.hasExistingData,
        existingCount: existingInfo.existingCount,
        categoryName: existingInfo.categoryName
      });
    } else {
      console.error('❌ Check-existing failed:', await checkExistingResponse.text());
      return;
    }

    // Step 4: Create a small test CSV
    console.log('\n4. 📄 Creating test CSV...');
    const testCsvContent = 'idwilayah,nomorResponden,catatan\n"region-1","001","Test catatan 1"\n"region-1","002","Test catatan 2"';
    const testFile = new Blob([testCsvContent], { type: 'text/csv' });
    
    console.log('✅ Test CSV created with 2 records');

    // Step 5: Test upload endpoint with form data
    console.log('\n5. 🚀 Testing upload endpoint...');
    const formData = new FormData();
    formData.append('file', testFile, 'test.csv');
    formData.append('categoryId', testCategoryId);

    const uploadResponse = await fetch(`${baseUrl}/api/catatan-survei/upload`, {
      method: 'POST',
      headers: { 'Cookie': authCookie },
      credentials: 'include',
      body: formData
    });

    console.log(`Upload status: ${uploadResponse.status}`);
    
    if (uploadResponse.ok) {
      const uploadResult = await uploadResponse.json();
      console.log('✅ Upload successful!', {
        success: uploadResult.success,
        imported: uploadResult.imported,
        hasErrors: uploadResult.errors ? uploadResult.errors.length : 0,
        categoryName: uploadResult.categoryName
      });

      if (uploadResult.preview && uploadResult.preview.length > 0) {
        console.log('📊 Preview data:', uploadResult.preview.slice(0, 2).map(item => ({
          nomorResponden: item.nomorResponden,
          catatan: item.catatan?.substring(0, 50) + '...',
          region: item.region?.city
        })));
      }
    } else {
      const errorText = await uploadResponse.text();
      console.error('❌ Upload failed:', errorText);
      
      // Try to parse error details
      try {
        const errorJson = JSON.parse(errorText);
        console.log('Error details:', errorJson);
      } catch (e) {
        console.log('Raw error:', errorText.substring(0, 500));
      }
    }

    console.log('\n🎉 Upload functionality test completed!');
    console.log('💡 If upload succeeded, you can now safely use the /catatan-survei page upload feature.');

  } catch (error) {
    console.error('❌ Test failed with exception:', error.message);
    console.error('Stack:', error.stack);
  }
}

testUploadFix().catch(console.error);