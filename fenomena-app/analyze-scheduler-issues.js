const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function analyzeSchedulerIssues() {
  try {
    console.log('🔍 ANALYZING SCHEDULER ISSUES');
    console.log('================================');
    console.log();

    const now = new Date();
    const currentTime = now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    console.log(`🕒 Current time (Jakarta): ${currentTime}`);
    console.log();

    // 1. Get detailed schedule analysis
    console.log('1️⃣ DETAILED SCHEDULE ANALYSIS:');
    const { data: schedules, error: schedError } = await supabase
      .from('scrapping_schedules')
      .select('*')
      .order('createdAt', { ascending: false });
      
    if (schedError) {
      console.error('❌ Error fetching schedules:', schedError.message);
      return;
    }

    schedules.forEach(schedule => {
      console.log(`📋 Schedule: ${schedule.name}`);
      console.log(`   Portal: ${schedule.portalUrl}`);
      console.log(`   Cron: ${schedule.cronSchedule}`);
      console.log(`   Active: ${schedule.isActive ? '🟢 Yes' : '🔴 No'}`);
      
      if (schedule.lastRun) {
        const lastRunDate = new Date(schedule.lastRun);
        const jakartaTime = lastRunDate.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        console.log(`   Last run: ${jakartaTime} (${schedule.lastRun})`);
        
        // Calculate hours since last run
        const hoursSinceLastRun = (now - lastRunDate) / (1000 * 60 * 60);
        console.log(`   Hours since last run: ${hoursSinceLastRun.toFixed(1)} hours`);
      } else {
        console.log(`   Last run: Never`);
      }
      
      if (schedule.nextRun) {
        const nextRunDate = new Date(schedule.nextRun);
        const jakartaTime = nextRunDate.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        console.log(`   Next run: ${jakartaTime} (${schedule.nextRun})`);
        
        // Check if next run is in the past
        if (nextRunDate < now) {
          console.log(`   ⚠️  ISSUE: Next run time is in the past! Should have run already.`);
        }
      } else {
        console.log(`   Next run: Not scheduled`);
      }
      
      console.log();
    });

    // 2. Check for recent scraping activity patterns
    console.log('2️⃣ RECENT SCRAPING PATTERNS:');
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const { data: recentArticles, error: recentError } = await supabase
      .from('scrapping_berita')
      .select('portalBerita, createdAt, tanggalScrap')
      .gte('createdAt', lastWeek.toISOString())
      .order('createdAt', { ascending: false });
      
    if (recentError) {
      console.error('❌ Error fetching recent articles:', recentError.message);
    } else {
      // Group by date
      const activityByDate = {};
      recentArticles.forEach(article => {
        const dateKey = article.createdAt.split('T')[0];
        if (!activityByDate[dateKey]) {
          activityByDate[dateKey] = { total: 0, byPortal: {} };
        }
        activityByDate[dateKey].total++;
        if (!activityByDate[dateKey].byPortal[article.portalBerita]) {
          activityByDate[dateKey].byPortal[article.portalBerita] = 0;
        }
        activityByDate[dateKey].byPortal[article.portalBerita]++;
      });

      console.log('Last 7 days activity:');
      const dates = Object.keys(activityByDate).sort().reverse();
      dates.forEach(date => {
        const activity = activityByDate[date];
        console.log(`📅 ${date}: ${activity.total} articles`);
        Object.keys(activity.byPortal).forEach(portal => {
          console.log(`   ${portal}: ${activity.byPortal[portal]} articles`);
        });
      });
      
      if (dates.length === 0) {
        console.log('❌ No scraping activity found in the last 7 days!');
      }
    }

    // 3. Check for scheduler service status indicators
    console.log();
    console.log('3️⃣ POTENTIAL ISSUES & SOLUTIONS:');
    
    const activeSchedules = schedules.filter(s => s.isActive);
    const overdueSchedules = activeSchedules.filter(s => {
      if (!s.nextRun) return false;
      return new Date(s.nextRun) < now;
    });

    if (activeSchedules.length === 0) {
      console.log('❌ ISSUE: No active schedules found');
      console.log('   SOLUTION: Activate at least one scraping schedule');
    } else {
      console.log(`✅ Active schedules: ${activeSchedules.length}`);
    }

    if (overdueSchedules.length > 0) {
      console.log(`❌ ISSUE: ${overdueSchedules.length} schedules are overdue (should have run already)`);
      console.log('   SOLUTION: The scheduler service might not be running');
      overdueSchedules.forEach(schedule => {
        console.log(`   - ${schedule.name}: was due ${new Date(schedule.nextRun).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`);
      });
    }

    // Check if any schedule should have run today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySchedules = activeSchedules.filter(s => {
      if (!s.cronSchedule) return false;
      
      // Simple check for daily schedules (0 8 * * * or 0 18 * * *)
      if (s.cronSchedule === '0 8 * * *') {
        const shouldRun = new Date(today);
        shouldRun.setHours(8, 0, 0, 0);
        return shouldRun <= now;
      } else if (s.cronSchedule === '0 18 * * *') {
        const shouldRun = new Date(today);
        shouldRun.setHours(18, 0, 0, 0);
        return shouldRun <= now;
      }
      return false;
    });

    if (todaySchedules.length > 0) {
      console.log();
      console.log('⚠️  CRITICAL: The following schedules should have run today but no articles were found:');
      todaySchedules.forEach(schedule => {
        const time = schedule.cronSchedule === '0 8 * * *' ? '08:00' : '18:00';
        console.log(`   - ${schedule.name} (${schedule.portalUrl}) at ${time}`);
      });
    }

    console.log();
    console.log('4️⃣ RECOMMENDED ACTIONS:');
    console.log('1. Check if the scheduler service is running on the server');
    console.log('2. Verify that the Next.js application is running and the scheduler is initialized');
    console.log('3. Check server logs for any scraping errors or network issues');
    console.log('4. Test manual scraping to ensure the scraping service is working');
    console.log('5. Verify timezone settings (schedules use Asia/Jakarta timezone)');

  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
    console.error(error);
  }
}

// Run the analysis
analyzeSchedulerIssues().then(() => {
  console.log('\n🏁 Analysis completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed to run analysis:', error);
  process.exit(1);
});