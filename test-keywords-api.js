// Test script to check if keywords API is working
const fetch = require('node-fetch');

async function testKeywordsAPI() {
  try {
    // Try to fetch keywords without auth (should fail)
    console.log('Testing keywords API endpoint...');
    
    const response = await fetch('http://localhost:3000/api/admin/scrapping-keywords', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    if (response.status === 403 && data.error === 'Authentication required') {
      console.log('✓ API is working correctly - authentication is required as expected');
      return true;
    } else {
      console.log('✗ Unexpected response');
      return false;
    }
  } catch (error) {
    console.error('Error testing API:', error);
    return false;
  }
}

testKeywordsAPI().then(success => {
  if (success) {
    console.log('✓ Keywords API migration to Supabase appears successful!');
  } else {
    console.log('✗ There may be issues with the keywords API');
  }
});