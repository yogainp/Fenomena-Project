// Test API response structure to prevent null errors
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://abndwvxmpimfvhriqxuc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFibmR3dnhtcGltZnZocmlxeHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MzMxNjQsImV4cCI6MjA3MDEwOTE2NH0.D70Iawv1rEL7ogX_H3S7Cd9ARx-yMFhfTDaDmDF0Gis';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAPIResponse() {
    try {
        console.log('Testing API response structure...');
        
        // Test recent news data structure
        const { data: recentNews, error } = await supabase
            .from('scrapping_berita')
            .select('id, judul, portalBerita, tanggalScrap, matchedKeywords')
            .order('tanggalScrap', { ascending: false })
            .limit(5);
            
        if (error) {
            console.error('Error:', error);
            return;
        }
        
        console.log('Recent news count:', recentNews.length);
        
        if (recentNews.length > 0) {
            console.log('\nSample news structure:');
            const sample = recentNews[0];
            console.log('- judul:', typeof sample.judul, sample.judul ? 'has value' : 'null/empty');
            console.log('- portalBerita:', typeof sample.portalBerita, sample.portalBerita ? 'has value' : 'null/empty');
            console.log('- tanggalScrap:', typeof sample.tanggalScrap, sample.tanggalScrap ? 'has value' : 'null/empty');
            console.log('- matchedKeywords:', typeof sample.matchedKeywords, Array.isArray(sample.matchedKeywords) ? `array with ${sample.matchedKeywords.length} items` : 'not array or null');
            
            console.log('\nAll news items check:');
            recentNews.forEach((item, index) => {
                const issues = [];
                if (!item.judul) issues.push('judul is null/empty');
                if (!item.portalBerita) issues.push('portalBerita is null/empty');
                if (!item.tanggalScrap) issues.push('tanggalScrap is null/empty');
                if (!Array.isArray(item.matchedKeywords)) issues.push('matchedKeywords is not array');
                
                if (issues.length > 0) {
                    console.log(`Item ${index}: ${issues.join(', ')}`);
                } else {
                    console.log(`Item ${index}: OK`);
                }
            });
        } else {
            console.log('No news found - this might be why the error occurs');
        }
        
    } catch (error) {
        console.error('Test error:', error);
    }
}

testAPIResponse();