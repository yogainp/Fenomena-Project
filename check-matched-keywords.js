// Check the actual structure of matchedKeywords
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://abndwvxmpimfvhriqxuc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFibmR3dnhtcGltZnZocmlxeHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MzMxNjQsImV4cCI6MjA3MDEwOTE2NH0.D70Iawv1rEL7ogX_H3S7Cd9ARx-yMFhfTDaDmDF0Gis';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMatchedKeywords() {
    try {
        const { data, error } = await supabase
            .from('scrapping_berita')
            .select('*')
            .limit(3);
            
        if (error) {
            console.error('Error:', error);
            return;
        }
        
        console.log('Sample data from scrapping_berita:');
        data.forEach((item, index) => {
            console.log(`\nItem ${index}:`);
            console.log('matchedKeywords:', item.matchedKeywords);
            console.log('matchedKeywords type:', typeof item.matchedKeywords);
            console.log('matchedKeywords value:', JSON.stringify(item.matchedKeywords));
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

checkMatchedKeywords();