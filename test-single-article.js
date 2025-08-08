const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://abndwvxmpimfvhriqxuc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFibmR3dnhtcGltZnZocmlxeHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MzMxNjQsImV4cCI6MjA3MDEwOTE2NH0.D70Iawv1rEL7ogX_H3S7Cd9ARx-yMFhfTDaDmDF0Gis';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSingleArticle() {
    try {
        // Get the first article
        const { data: articles, error } = await supabase
            .from('scrapping_berita')
            .select('*')
            .limit(1);
            
        if (error) {
            console.error('Error:', error);
            return;
        }
        
        if (articles && articles.length > 0) {
            const article = articles[0];
            console.log('Sample article:');
            console.log('ID:', article.id);
            console.log('Title:', article.judul);
            console.log('Portal:', article.portalBerita);
            console.log('matchedKeywords:', article.matchedKeywords);
            console.log('matchedKeywords type:', typeof article.matchedKeywords);
            console.log('matchedKeywords Array?:', Array.isArray(article.matchedKeywords));
            console.log('All fields:', Object.keys(article));
        } else {
            console.log('No articles found');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testSingleArticle();