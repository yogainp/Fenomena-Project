// Using built-in fetch (Node.js 18+)

async function testCatalogDetail() {
  const baseUrl = 'http://localhost:3000';
  
  // Get auth token
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

  // Test catalog endpoint
  console.log('🧪 Testing catalog endpoint detail...');
  
  const response = await fetch(`${baseUrl}/api/katalog-berita?page=1&limit=2`, {
    headers: {
      'Cookie': `auth-token=${authToken}`
    }
  });

  if (response.ok) {
    const data = await response.json();
    console.log('✅ Catalog Response Structure:');
    console.log(JSON.stringify({
      beritaCount: data.berita?.length,
      pagination: data.pagination,
      sampleBerita: data.berita?.[0] ? {
        id: data.berita[0].id,
        judul: data.berita[0].judul?.substring(0, 50) + '...',
        portalBerita: data.berita[0].portalBerita,
        hasContent: !!data.berita[0].isi
      } : 'No data'
    }, null, 2));
  } else {
    const errorText = await response.text();
    console.log('❌ Error:', errorText);
  }
}

testCatalogDetail().catch(console.error);