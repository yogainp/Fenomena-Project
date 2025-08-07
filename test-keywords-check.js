// Script to test keywords statistics
// Run this in browser console when logged in as admin

async function testKeywordsAPI() {
    try {
        console.log('Testing keywords statistics...');
        
        const response = await fetch('/api/admin/scrapping-berita/execute', {
            method: 'GET',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('✅ Success! API Response:');
            console.log('Total News:', data.statistics.totalNews);
            console.log('Today News:', data.statistics.todayNews);  
            console.log('Total Keywords:', data.statistics.totalKeywords);
            console.log('Active Keywords:', data.statistics.activeKeywords);
            
            if (data.statistics.activeKeywords > 0) {
                console.log('🎉 Active keywords detected! Scrapping button should be enabled.');
            } else {
                console.log('⚠️ No active keywords found. Check keywords table.');
            }
        } else {
            console.error('❌ API Error:', data);
        }
        
        return data;
    } catch (error) {
        console.error('❌ Network Error:', error);
        return null;
    }
}

// Test the API
testKeywordsAPI();