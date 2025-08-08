// Debug the keywords issue in detail
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://abndwvxmpimfvhriqxuc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFibmR3dnhtcGltZnZocmlxeHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MzMxNjQsImV4cCI6MjA3MDEwOTE2NH0.D70Iawv1rEL7ogX_H3S7Cd9ARx-yMFhfTDaDmDF0Gis';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugKeywordsIssue() {
    console.log('=== DEBUGGING KEYWORDS ISSUE ===\n');
    
    try {
        // 1. Check if there are any active keywords
        console.log('1. Checking active keywords:');
        const { data: activeKeywords, error: keywordError } = await supabase
            .from('scrapping_keywords')
            .select('*')
            .eq('isActive', true);
            
        if (keywordError) {
            console.error('Error fetching keywords:', keywordError);
            return;
        }
        
        console.log(`Found ${activeKeywords ? activeKeywords.length : 0} active keywords:`);
        if (activeKeywords) {
            activeKeywords.forEach(k => console.log(`  - ${k.keyword} (matches: ${k.matchCount})`));
        }
        
        // 2. Check recent articles and their keywords
        console.log('\n2. Checking recent articles:');
        const { data: recentArticles, error: articleError } = await supabase
            .from('scrapping_berita')
            .select('id, judul, matchedKeywords, tanggalScrap')
            .order('tanggalScrap', { ascending: false })
            .limit(5);
            
        if (articleError) {
            console.error('Error fetching articles:', articleError);
            return;
        }
        
        console.log(`Found ${recentArticles ? recentArticles.length : 0} recent articles:`);
        if (recentArticles) {
            recentArticles.forEach((article, index) => {
                console.log(`\n  Article ${index + 1}:`);
                console.log(`    Title: ${(article.judul || '').substring(0, 80)}...`);
                console.log(`    Keywords: ${JSON.stringify(article.matchedKeywords)}`);
                console.log(`    Keywords type: ${typeof article.matchedKeywords}`);
                console.log(`    Date: ${article.tanggalScrap}`);
            });
        }
        
        // 3. Test if we can insert a test article with keywords
        console.log('\n3. Testing keyword insertion...');
        const testData = {
            id: 'test-' + Date.now(),
            idBerita: 'test-article-' + Date.now(),
            portalBerita: 'test-portal',
            linkBerita: 'https://test.com/article-' + Date.now(),
            judul: 'Test Article with Keywords',
            isi: 'This is a test article containing some keywords for testing.',
            tanggalBerita: new Date().toISOString(),
            matchedKeywords: ['test', 'article', 'keywords'],
        };
        
        const { data: insertResult, error: insertError } = await supabase
            .from('scrapping_berita')
            .insert(testData)
            .select()
            .single();
            
        if (insertError) {
            console.error('Test insertion failed:', insertError);
        } else {
            console.log('Test insertion successful!');
            console.log('Inserted data:', {
                id: insertResult.id,
                judul: insertResult.judul,
                matchedKeywords: insertResult.matchedKeywords
            });
            
            // Clean up test data
            await supabase.from('scrapping_berita').delete().eq('id', insertResult.id);
            console.log('Test data cleaned up.');
        }
        
    } catch (error) {
        console.error('Debug error:', error);
    }
}

debugKeywordsIssue();