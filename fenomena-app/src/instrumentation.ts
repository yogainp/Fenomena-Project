// Next.js instrumentation file for auto-initializing services on server startup
import { schedulerService } from '@/lib/scheduler-service';

export async function register() {
  // This function runs once when the Next.js server starts
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🚀 [STARTUP] Initializing Fenomena App services...');
    
    try {
      // Auto-initialize scheduler service on server startup
      await schedulerService.initialize();
      console.log('✅ [STARTUP] Scheduler service initialized successfully');
    } catch (error) {
      console.error('❌ [STARTUP] Failed to initialize scheduler service:', error);
      // Don't throw error to prevent server startup failure
      // Just log the error - admin can manually initialize via /api/admin/manage-scraping/init
    }
    
    console.log('🎉 [STARTUP] Fenomena App services initialization complete');
  }
}