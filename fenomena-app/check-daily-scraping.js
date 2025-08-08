const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDailyScraping() {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
    console.log('📅 Checking scraping activity for:', startOfDay.toISOString().split('T')[0]);
    console.log('🔍 Timeframe:', startOfDay.toISOString(), 'to', endOfDay.toISOString());
    console.log();

    // 1. Check active scraping schedules
    console.log('1️⃣ CHECKING ACTIVE SCRAPING SCHEDULES:');
    const { data: schedules, error: schedError } = await supabase
      .from('scrapping_schedules')
      .select('*')
      .order('createdAt', { ascending: false });
      
    if (schedError) {
      console.error('❌ Error fetching schedules:', schedError.message);
    } else {
      console.log(`📋 Total schedules: ${schedules?.length || 0}`);
      const activeSchedules = schedules?.filter(s => s.isActive) || [];
      console.log(`🟢 Active schedules: ${activeSchedules.length}`);
      
      if (activeSchedules.length > 0) {
        console.log('   Active schedules details:');
        activeSchedules.forEach(schedule => {
          console.log(`   - ${schedule.name}`);
          console.log(`     Portal: ${schedule.portalUrl}`);
          console.log(`     Schedule: ${schedule.cronSchedule}`);
          console.log(`     Last run: ${schedule.lastRun ? new Date(schedule.lastRun).toLocaleString() : 'Never'}`);
          console.log(`     Next run: ${schedule.nextRun ? new Date(schedule.nextRun).toLocaleString() : 'Not scheduled'}`);
          console.log();
        });
      }
      
      const inactiveSchedules = schedules?.filter(s => !s.isActive) || [];
      if (inactiveSchedules.length > 0) {
        console.log(`🔴 Inactive schedules: ${inactiveSchedules.length}`);
        inactiveSchedules.forEach(schedule => {
          console.log(`   - ${schedule.name} (${schedule.portalUrl})`);
        });
        console.log();
      }
    }

    // 2. Check articles scraped today
    console.log('2️⃣ CHECKING ARTICLES SCRAPED TODAY:');
    const { data: todayArticles, error: todayError } = await supabase
      .from('scrapping_berita')
      .select('id, judul, tanggalBerita, portalBerita, createdAt')
      .gte('createdAt', startOfDay.toISOString())
      .lte('createdAt', endOfDay.toISOString())
      .order('createdAt', { ascending: false });
      
    if (todayError) {
      console.error('❌ Error fetching today\'s articles:', todayError.message);
    } else {
      console.log(`📰 Articles scraped today: ${todayArticles?.length || 0}`);
      
      if (todayArticles && todayArticles.length > 0) {
        // Group by portal
        const byPortal = {};
        todayArticles.forEach(article => {
          if (!byPortal[article.portalBerita]) {
            byPortal[article.portalBerita] = [];
          }
          byPortal[article.portalBerita].push(article);
        });
        
        console.log('   Articles by portal:');
        Object.keys(byPortal).forEach(portal => {
          console.log(`   📰 ${portal}: ${byPortal[portal].length} articles`);
          byPortal[portal].slice(0, 3).forEach(article => {
            console.log(`      - ${article.judul.substring(0, 60)}...`);
            console.log(`        Created: ${new Date(article.createdAt).toLocaleString()}`);
          });
          if (byPortal[portal].length > 3) {
            console.log(`      ... and ${byPortal[portal].length - 3} more`);
          }
          console.log();
        });
      }
    }

    // 3. Check recent articles (last 3 days for comparison)
    console.log('3️⃣ CHECKING RECENT SCRAPING ACTIVITY (Last 3 days):');
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const { data: recentArticles, error: recentError } = await supabase
      .from('scrapping_berita')
      .select('portalBerita, createdAt')
      .gte('createdAt', threeDaysAgo.toISOString())
      .order('createdAt', { ascending: false });
      
    if (recentError) {
      console.error('❌ Error fetching recent articles:', recentError.message);
    } else {
      console.log(`📊 Total articles in last 3 days: ${recentArticles?.length || 0}`);
      
      if (recentArticles && recentArticles.length > 0) {
        // Group by date and portal
        const byDate = {};
        recentArticles.forEach(article => {
          const dateKey = article.createdAt.split('T')[0];
          if (!byDate[dateKey]) {
            byDate[dateKey] = {};
          }
          if (!byDate[dateKey][article.portalBerita]) {
            byDate[dateKey][article.portalBerita] = 0;
          }
          byDate[dateKey][article.portalBerita]++;
        });
        
        console.log('   Activity by date:');
        Object.keys(byDate).sort().reverse().forEach(date => {
          console.log(`   📅 ${date}:`);
          Object.keys(byDate[date]).forEach(portal => {
            console.log(`      ${portal}: ${byDate[date][portal]} articles`);
          });
        });
      }
    }

    // 4. Check for any errors or issues
    console.log('4️⃣ SUMMARY & RECOMMENDATIONS:');
    const totalToday = todayArticles?.length || 0;
    const activeCount = schedules?.filter(s => s.isActive).length || 0;
    
    if (activeCount === 0) {
      console.log('⚠️  WARNING: No active scraping schedules found!');
    } else if (totalToday === 0) {
      console.log('⚠️  WARNING: No articles were scraped today despite having active schedules!');
      console.log('   Possible issues:');
      console.log('   - Scheduler service might not be running');
      console.log('   - Schedules might not be triggered yet');
      console.log('   - Website scraping might be failing');
      console.log('   - Network connectivity issues');
    } else {
      console.log(`✅ Scraping appears to be working: ${totalToday} articles scraped today`);
    }

  } catch (error) {
    console.error('❌ Error during check:', error.message);
    console.error(error);
  }
}

// Run the check
checkDailyScraping().then(() => {
  console.log('\n🏁 Check completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed to run check:', error);
  process.exit(1);
});