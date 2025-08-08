// Complete upload test with valid data
async function testCompleteUpload() {
  const baseUrl = 'http://localhost:3000';
  
  try {
    console.log('🧪 Testing Complete Upload Fix...\n');

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
      console.error('❌ Login failed');
      return;
    }

    const setCookieHeader = loginResponse.headers.get('set-cookie');
    const authCookie = setCookieHeader || '';
    console.log('✅ Login successful');

    // Step 2: Get categories
    console.log('\n2. 📂 Getting categories...');
    const categoriesResponse = await fetch(`${baseUrl}/api/categories`, {
      credentials: 'include',
      headers: { 'Cookie': authCookie }
    });

    const categories = await categoriesResponse.json();
    const testCategoryId = categories[0].id;
    console.log(`✅ Using category: ${categories[0].name}`);

    // Step 3: Create test CSV with valid region codes
    console.log('\n3. 📄 Creating test CSV with valid region codes...');
    const testCsvContent = `idwilayah,nomorResponden,catatan
"6102","001","Test catatan responden 1 - Kabupaten Bengkayang"
"6108","002","Test catatan responden 2 - Kabupaten Kapuas Hulu"
"6111","003","Test catatan responden 3 - Kabupaten Kayong Utara"`;

    const testFile = new Blob([testCsvContent], { type: 'text/csv' });
    console.log('✅ Test CSV created with 3 valid records');

    // Step 4: Upload the test data
    console.log('\n4. 🚀 Uploading test data...');
    const formData = new FormData();
    formData.append('file', testFile, 'test-upload.csv');
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
      console.log('✅ Upload successful!');
      console.log(`   • Imported: ${uploadResult.imported} records`);
      console.log(`   • Category: ${uploadResult.categoryName}`);
      console.log(`   • Errors: ${uploadResult.errors ? uploadResult.errors.length : 0}`);
      
      if (uploadResult.preview && uploadResult.preview.length > 0) {
        console.log('\n📊 Preview of uploaded data:');
        uploadResult.preview.forEach((item, i) => {
          console.log(`   ${i + 1}. Responden ${item.nomorResponden}: ${item.catatan?.substring(0, 50)}... (${item.region?.city})`);
        });
      }

      console.log('\n🎉 SUCCESS: Upload functionality is working correctly!');
      console.log('💡 The /catatan-survei page upload feature should now work without internal server errors.');
      
    } else {
      const errorText = await uploadResponse.text();
      console.error('❌ Upload failed:', errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.details) {
          console.log('Error details:', errorJson.details);
        }
      } catch (e) {
        // Error text is not JSON
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCompleteUpload().catch(console.error);