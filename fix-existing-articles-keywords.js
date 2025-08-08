// Fix existing articles by adding matched keywords retroactively
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://abndwvxmpimfvhriqxuc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFibmR3dnhtcGltZnZocmlxeHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MzMxNjQsImV4cCI6MjA3MDEwOTE2NH0.D70Iawv1rEL7ogX_H3S7Cd9ARx-yMFhfTDaDmDF0Gis';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixExistingArticlesKeywords() {
    console.log('=== FIXING EXISTING ARTICLES KEYWORDS ===\n');
    
    try {
        // 1. Get all active keywords
        console.log('1. Fetching active keywords...');
        const { data: activeKeywords, error: keywordError } = await supabase
            .from('scrapping_keywords')
            .select('keyword')
            .eq('isActive', true);
            
        if (keywordError) {
            console.error('Error fetching keywords:', keywordError);
            return;
        }
        
        if (!activeKeywords || activeKeywords.length === 0) {
            console.log('No active keywords found. Exiting.');
            return;
        }
        
        const keywordList = activeKeywords.map(k => k.keyword.toLowerCase());
        console.log(`Found ${keywordList.length} active keywords:`, keywordList);
        
        // 2. Get all articles with null matchedKeywords
        console.log('\n2. Fetching articles with null matchedKeywords...');
        const { data: articlesWithNullKeywords, error: articleError } = await supabase
            .from('scrapping_berita')
            .select('id, judul, isi, matchedKeywords')
            .is('matchedKeywords', null);
            
        if (articleError) {
            console.error('Error fetching articles:', articleError);
            return;
        }
        
        if (!articlesWithNullKeywords || articlesWithNullKeywords.length === 0) {
            console.log('No articles with null keywords found. All articles already have keywords assigned.');
            return;
        }
        
        console.log(`Found ${articlesWithNullKeywords.length} articles with null keywords`);
        
        // 3. Process articles in batches to avoid overwhelming the database
        const batchSize = 10;
        let updatedCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < articlesWithNullKeywords.length; i += batchSize) {
            const batch = articlesWithNullKeywords.slice(i, i + batchSize);
            console.log(`\nProcessing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(articlesWithNullKeywords.length/batchSize)} (articles ${i + 1}-${Math.min(i + batchSize, articlesWithNullKeywords.length)})`);
            
            // Process each article in the batch
            const batchPromises = batch.map(async (article) => {
                try {
                    // Find matched keywords in title and content
                    const titleLower = (article.judul || '').toLowerCase();
                    const contentLower = (article.isi || '').toLowerCase();
                    
                    const matchedKeywords = keywordList.filter(keyword => 
                        titleLower.includes(keyword) || contentLower.includes(keyword)
                    );
                    
                    console.log(`  Article "${article.judul.substring(0, 50)}..." -> Keywords: [${matchedKeywords.join(', ')}]`);
                    
                    // Update the article with matched keywords (even if empty array)
                    const { error: updateError } = await supabase
                        .from('scrapping_berita')
                        .update({ matchedKeywords: matchedKeywords })
                        .eq('id', article.id);
                        
                    if (updateError) {
                        console.error(`  ERROR updating article ${article.id}:`, updateError);
                        return { success: false, error: updateError };
                    }
                    
                    return { success: true, matchedKeywords };
                } catch (error) {
                    console.error(`  ERROR processing article ${article.id}:`, error);
                    return { success: false, error };
                }
            });
            
            // Wait for batch to complete
            const batchResults = await Promise.all(batchPromises);
            
            // Count successes and errors
            const batchSuccesses = batchResults.filter(r => r.success);
            const batchErrors = batchResults.filter(r => !r.success);
            
            updatedCount += batchSuccesses.length;
            errorCount += batchErrors.length;
            
            console.log(`  Batch completed: ${batchSuccesses.length} updated, ${batchErrors.length} errors`);
            
            // Small delay between batches to be gentle on the database
            if (i + batchSize < articlesWithNullKeywords.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log(`\n=== SUMMARY ===`);
        console.log(`Total articles processed: ${articlesWithNullKeywords.length}`);
        console.log(`Successfully updated: ${updatedCount}`);
        console.log(`Errors: ${errorCount}`);
        
        // 4. Update keyword match counts
        console.log('\n4. Updating keyword match counts...');
        
        // Get updated articles to count keyword matches
        const { data: allArticles } = await supabase
            .from('scrapping_berita')
            .select('matchedKeywords')
            .not('matchedKeywords', 'is', null);
            
        if (allArticles) {
            const keywordCounts = {};
            
            // Count matches for each keyword
            allArticles.forEach(article => {
                if (article.matchedKeywords && Array.isArray(article.matchedKeywords)) {
                    article.matchedKeywords.forEach(keyword => {
                        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
                    });
                }
            });
            
            // Update match counts in keywords table
            for (const [keyword, count] of Object.entries(keywordCounts)) {
                const { error: countUpdateError } = await supabase
                    .from('scrapping_keywords')
                    .update({ matchCount: count })
                    .eq('keyword', keyword);
                    
                if (countUpdateError) {
                    console.error(`Error updating count for keyword "${keyword}":`, countUpdateError);
                } else {
                    console.log(`  Updated "${keyword}" count to ${count}`);
                }
            }
        }
        
        console.log('\n✅ Finished updating existing articles with keywords!');
        
    } catch (error) {
        console.error('Fatal error:', error);
    }
}

fixExistingArticlesKeywords();