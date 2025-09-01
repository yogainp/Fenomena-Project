const { createClient } = require('@supabase/supabase-js');

// Setup environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function getNextRunTime(cronExpression) {
  try {
    // Simple calculation for daily at 8 AM WIB
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(8, 0, 0, 0); // Set to 8 AM
    
    // If it's already past 8 AM today, set to 8 AM tomorrow
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    console.log(`⏰ Next run calculated: ${nextRun.toISOString()} UTC`);
    return nextRun;
  } catch (error) {
    console.error('❌ Error calculating next run time:', error);
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
}

// Schedule data for 3 portals - all running daily at 8 AM
const schedulesToCreate = [
  {
    id: crypto.randomUUID(),
    name: 'Kalbar Online Daily Scraping',
    portalUrl: 'https://kalbaronline.com/berita-daerah/',
    maxPages: 5,
    delayMs: 2000,
    cronSchedule: '0 8 * * *', // Daily at 8 AM WIB
    isActive: true,
    nextRun: getNextRunTime('0 8 * * *').toISOString()
  },
  {
    id: crypto.randomUUID(),
    name: 'Antara News Kalbar Daily Scraping',
    portalUrl: 'https://kalbar.antaranews.com/kalbar',
    maxPages: 5,
    delayMs: 2000,
    cronSchedule: '0 8 * * *', // Daily at 8 AM WIB
    isActive: true,
    nextRun: getNextRunTime('0 8 * * *').toISOString()
  },
  {
    id: crypto.randomUUID(),
    name: 'Suara Kalbar Daily Scraping',
    portalUrl: 'https://www.suarakalbar.co.id/category/kalbar/',
    maxPages: 5,
    delayMs: 2000,
    cronSchedule: '0 8 * * *', // Daily at 8 AM WIB
    isActive: true,
    nextRun: getNextRunTime('0 8 * * *').toISOString()
  }
];

async function setupDailySchedules() {
  try {
    console.log('🚀 Setting up daily scraping schedules...');
    
    // First, check if schedules already exist
    console.log('🔍 Checking for existing schedules...');
    const { data: existingSchedules, error: fetchError } = await supabase
      .from('scrapping_schedules')
      .select('name, portalUrl')
      .in('name', schedulesToCreate.map(s => s.name));

    if (fetchError) {
      throw new Error(`Failed to fetch existing schedules: ${fetchError.message}`);
    }

    // Filter out schedules that already exist
    const existingNames = existingSchedules.map(s => s.name);
    const newSchedules = schedulesToCreate.filter(schedule => 
      !existingNames.includes(schedule.name)
    );

    if (existingSchedules.length > 0) {
      console.log(`⚠️ Found ${existingSchedules.length} existing schedules:`);
      existingSchedules.forEach(schedule => {
        console.log(`   - ${schedule.name} (${schedule.portalUrl})`);
      });
    }

    if (newSchedules.length === 0) {
      console.log('✅ All schedules already exist. No new schedules to create.');
      return;
    }

    console.log(`📝 Creating ${newSchedules.length} new schedules:`);
    newSchedules.forEach(schedule => {
      console.log(`   - ${schedule.name} (${schedule.portalUrl})`);
    });

    // Insert new schedules
    const { data: createdSchedules, error: insertError } = await supabase
      .from('scrapping_schedules')
      .insert(newSchedules)
      .select();

    if (insertError) {
      throw new Error(`Failed to create schedules: ${insertError.message}`);
    }

    console.log('✅ Daily scraping schedules created successfully!');
    console.log('\n📋 Schedule Summary:');
    console.log('═══════════════════════════════════════════════════════════════');
    
    createdSchedules.forEach((schedule, index) => {
      console.log(`${index + 1}. ${schedule.name}`);
      console.log(`   📡 Portal: ${schedule.portalUrl}`);
      console.log(`   ⏰ Schedule: ${schedule.cronSchedule} (Daily at 8 AM WIB)`);
      console.log(`   📄 Max Pages: ${schedule.maxPages}`);
      console.log(`   ⏱️  Delay: ${schedule.delayMs}ms`);
      console.log(`   🟢 Active: ${schedule.isActive}`);
      console.log(`   ⏭️  Next Run: ${new Date(schedule.nextRun).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`);
      console.log('');
    });

    console.log('🎯 All schedules will run daily at 8:00 AM WIB');
    console.log('📊 Total pages to scrape per day: ~15 pages (5 pages × 3 portals)');
    console.log('⚡ Vercel Cron Job will trigger all schedules in one execution');

  } catch (error) {
    console.error('❌ Failed to setup daily schedules:', error);
    process.exit(1);
  }
}

// Run the setup
setupDailySchedules()
  .then(() => {
    console.log('🏁 Setup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Setup failed:', error);
    process.exit(1);
  });