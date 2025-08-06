const { schedulerService } = require('./src/lib/scheduler-service.ts');

async function testScheduler() {
  try {
    console.log('🧪 Testing Scheduler Service...');
    
    // Test 1: Initialize scheduler
    console.log('\n1. Initializing scheduler...');
    await schedulerService.initialize();
    console.log('✅ Scheduler initialized');
    
    // Test 2: Check active jobs
    console.log('\n2. Checking active jobs...');
    const activeJobs = schedulerService.getActiveJobsCount();
    console.log(`✅ Active jobs: ${activeJobs}`);
    
    // Test 3: Get all schedules
    console.log('\n3. Getting all schedules...');
    const schedules = await schedulerService.getAllSchedules();
    console.log(`✅ Total schedules: ${schedules.length}`);
    
    if (schedules.length > 0) {
      console.log('📋 Existing schedules:');
      schedules.forEach(schedule => {
        console.log(`   - ${schedule.name}: ${schedule.isActive ? '🟢 Active' : '🔴 Inactive'}`);
      });
    }
    
    console.log('\n✅ Scheduler test completed successfully!');
    console.log('\n📝 Summary:');
    console.log(`   - Scheduler initialized: ✅`);
    console.log(`   - Active jobs: ${activeJobs}`);
    console.log(`   - Total schedules: ${schedules.length}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    // Clean shutdown
    console.log('\n🛑 Shutting down scheduler...');
    schedulerService.shutdown();
    process.exit(0);
  }
}

// Run test
testScheduler();