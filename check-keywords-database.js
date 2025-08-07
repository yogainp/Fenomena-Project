// Direct test to check keywords in database
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://abndwvxmpimfvhriqxuc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFibmR3dnhtcGltZnZocmlxeHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MzMxNjQsImV4cCI6MjA3MDEwOTE2NH0.D70Iawv1rEL7ogX_H3S7Cd9ARx-yMFhfTDaDmDF0Gis';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkKeywords() {
    try {
        console.log('Checking keywords in Supabase database...');
        
        // Get all keywords
        const { data: allKeywords, error: allError } = await supabase
            .from('scrapping_keywords')
            .select('*');
            
        if (allError) {
            console.error('Error fetching all keywords:', allError);
            return;
        }
        
        console.log('Total keywords in database:', allKeywords.length);
        
        // Get active keywords
        const { data: activeKeywords, error: activeError } = await supabase
            .from('scrapping_keywords')
            .select('*')
            .eq('isActive', true);
            
        if (activeError) {
            console.error('Error fetching active keywords:', activeError);
            return;
        }
        
        console.log('Active keywords:', activeKeywords.length);
        console.log('Active keywords list:', activeKeywords.map(k => k.keyword));
        
        if (allKeywords.length > 0) {
            console.log('✅ Keywords found in database');
            console.log('Sample keyword:', allKeywords[0]);
        } else {
            console.log('❌ No keywords found in database');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

checkKeywords();