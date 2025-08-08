// Test script to verify the 1000 record limitation fix
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://abndwvxmpimfvhriqxuc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFibmR3dnhtcGltZnZocmlxeHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MzMxNjQsImV4cCI6MjA3MDEwOTE2NH0.D70Iawv1rEL7ogX_H3S7Cd9ARx-yMFhfTDaDmDF0Gis';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCatatanSurveiCount() {
    console.log('=== Testing Catatan Survei Count ===\n');
    
    try {
        // 1. Get direct count from database
        console.log('1. Getting direct count from database...');
        const { count: totalInDB, error: countError } = await supabase
            .from('catatan_survei')
            .select('*', { count: 'exact', head: true });
            
        if (countError) {
            console.error('Error getting count:', countError);
            return;
        }
        
        console.log(`Total records in database: ${totalInDB}`);
        
        // 2. Get limited data (default behavior)
        console.log('\n2. Getting records without explicit limit...');
        const { data: limitedData, error: limitedError } = await supabase
            .from('catatan_survei')
            .select('id, catatan');
            
        if (limitedError) {
            console.error('Error getting limited data:', limitedError);
            return;
        }
        
        console.log(`Records fetched without limit: ${limitedData ? limitedData.length : 0}`);
        
        // 3. Get data with high explicit limit
        console.log('\n3. Getting records with high explicit limit (50000)...');
        const { data: unlimitedData, error: unlimitedError } = await supabase
            .from('catatan_survei')
            .select('id, catatan')
            .limit(50000);
            
        if (unlimitedError) {
            console.error('Error getting unlimited data:', unlimitedError);
            return;
        }
        
        console.log(`Records fetched with high limit: ${unlimitedData ? unlimitedData.length : 0}`);
        
        // 4. Analysis
        console.log('\n=== ANALYSIS ===');
        console.log(`Database contains ${totalInDB} total records`);
        console.log(`Default query returned ${limitedData ? limitedData.length : 0} records`);
        console.log(`High limit query returned ${unlimitedData ? unlimitedData.length : 0} records`);
        
        if (totalInDB > 1000) {
            if (limitedData && limitedData.length === 1000) {
                console.log('✅ Confirmed: Default Supabase limit is 1000 records');
            }
            
            if (unlimitedData && unlimitedData.length > 1000) {
                console.log('✅ Confirmed: Explicit high limit works to fetch more than 1000 records');
            }
            
            if (unlimitedData && unlimitedData.length === totalInDB) {
                console.log('✅ Perfect: High limit fetched ALL records from database');
            } else if (unlimitedData && unlimitedData.length < totalInDB) {
                console.log(`⚠️  Note: High limit fetched ${unlimitedData.length} of ${totalInDB} records`);
            }
        } else {
            console.log(`ℹ️  Database has ${totalInDB} records (less than 1000), so limitation wouldn't be visible`);
        }
        
    } catch (error) {
        console.error('Test error:', error);
    }
}

testCatatanSurveiCount();