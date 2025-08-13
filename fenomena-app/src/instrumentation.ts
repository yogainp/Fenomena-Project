// Next.js instrumentation file for auto-initializing services on server startup
import { schedulerService } from '@/lib/scheduler-service';

export async function register() {
  // This function runs once when the Next.js server starts
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const isVercel = process.env.VERCEL === '1';
    const environment = isVercel ? 'Vercel' : 'Local Development';
    
    console.log(`🚀 [STARTUP] Initializing Fenomena App services in ${environment}...`);
    
    try {
      // Auto-initialize scheduler service on server startup
      // The scheduler service will automatically detect environment and behave accordingly
      await schedulerService.initialize();
      console.log('✅ [STARTUP] Scheduler service initialized successfully');
      
      if (isVercel) {
        console.log('☁️ [STARTUP] Vercel environment detected - using database-driven scheduling');
        console.log('📅 [STARTUP] Cron jobs will be handled by Vercel Cron at /api/cron/execute-scheduled-scraping');
      } else {
        console.log('🔧 [STARTUP] Development environment detected - using in-memory cron jobs');
      }
    } catch (error) {
      console.error('❌ [STARTUP] Failed to initialize scheduler service:', error);
      // Don't throw error to prevent server startup failure
      // Just log the error - admin can manually initialize via /api/admin/manage-scraping/init
    }
    
    console.log('🎉 [STARTUP] Fenomena App services initialization complete');
  }
}