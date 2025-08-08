// Test different approaches to bypass Supabase 1000 record limit
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://abndwvxmpimfvhriqxuc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFibmR3dnhtcGltZnZocmlxeHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MzMxNjQsImV4cCI6MjA3MDEwOTE2NH0.D70Iawv1rEL7ogX_H3S7Cd9ARx-yMFhfTDaDmDF0Gis';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabaseLimitApproaches() {
    console.log('=== Testing Different Approaches to Bypass 1000 Limit ===\n');
    
    try {
        // Get total count first
        const { count: totalCount } = await supabase
            .from('catatan_survei')
            .select('*', { count: 'exact', head: true });
            
        console.log(`Total records in database: ${totalCount}`);
        
        // Approach 1: Using range
        console.log('\n1. Testing range(0, 2000)...');
        const { data: rangeData, error: rangeError } = await supabase
            .from('catatan_survei')
            .select('id')
            .range(0, 2000);
            
        console.log(`Range approach result: ${rangeData ? rangeData.length : 0} records`);
        if (rangeError) console.log('Range error:', rangeError.message);
        
        // Approach 2: Pagination with multiple requests
        console.log('\n2. Testing pagination approach...');
        const pageSize = 1000;
        const maxPages = 5; // Test first 5 pages = 5000 records
        let allData = [];
        
        for (let page = 0; page < maxPages; page++) {
            const start = page * pageSize;
            const end = start + pageSize - 1;
            
            const { data: pageData, error: pageError } = await supabase
                .from('catatan_survei')
                .select('id')
                .range(start, end);
                
            if (pageError) {
                console.log(`Page ${page} error:`, pageError.message);
                break;
            }
            
            if (!pageData || pageData.length === 0) {
                console.log(`Page ${page}: No more data`);
                break;
            }
            
            allData = allData.concat(pageData);
            console.log(`Page ${page}: ${pageData.length} records (total so far: ${allData.length})`);
            
            // If we got less than pageSize, we're done
            if (pageData.length < pageSize) {
                console.log('Reached end of data');
                break;
            }
        }
        
        console.log(`\nPagination approach total: ${allData.length} records`);
        
        // Approach 3: Try with different limits
        console.log('\n3. Testing various explicit limits...');
        const limitsToTest = [5000, 10000, 20000, 50000];
        
        for (const limit of limitsToTest) {
            const { data: limitData, error: limitError } = await supabase
                .from('catatan_survei')
                .select('id')
                .limit(limit);
                
            console.log(`Limit ${limit}: ${limitData ? limitData.length : 0} records`);
            if (limitError) console.log(`Limit ${limit} error:`, limitError.message);
            
            // If we got all records or hit the limit, we can stop
            if (limitData && limitData.length >= totalCount) {
                console.log(`✅ Limit ${limit} successfully fetched all ${totalCount} records!`);
                break;
            }
        }
        
    } catch (error) {
        console.error('Test error:', error);
    }
}

testSupabaseLimitApproaches();