import { NextRequest, NextResponse } from 'next/server';
import { schedulerService } from '@/lib/scheduler-service';

// Vercel Cron Job endpoint for executing scheduled scraping tasks
// This endpoint is designed to be called by Vercel Cron Jobs or external cron services

export async function GET(request: NextRequest) {
  try {
    console.log('🕒 [CRON ENDPOINT] Vercel cron job triggered');
    
    // Optional: Add basic authentication for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // If CRON_SECRET is set, verify it matches the authorization header
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('⚠️ [CRON ENDPOINT] Unauthorized cron request');
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Execute all due scheduled scraping tasks
    const result = await schedulerService.executeAllDueSchedules();
    
    console.log('✅ [CRON ENDPOINT] Cron execution completed:', result);
    
    return NextResponse.json({
      message: 'Scheduled scraping execution completed',
      result
    });

  } catch (error: any) {
    console.error('❌ [CRON ENDPOINT] Cron execution failed:', error);
    
    return NextResponse.json({
      error: 'Cron execution failed',
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// POST method for manual triggering or external cron services
export async function POST(request: NextRequest) {
  try {
    console.log('🕒 [CRON ENDPOINT] Manual/external cron trigger');
    
    const body = await request.json().catch(() => ({}));
    const { secret, scheduleIds } = body;
    
    // Optional: Add basic authentication for security
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && secret !== cronSecret) {
      console.warn('⚠️ [CRON ENDPOINT] Unauthorized cron request');
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Execute all due scheduled scraping tasks
    const result = await schedulerService.executeAllDueSchedules();
    
    console.log('✅ [CRON ENDPOINT] Manual cron execution completed:', result);
    
    return NextResponse.json({
      message: 'Manual scheduled scraping execution completed',
      result
    });

  } catch (error: any) {
    console.error('❌ [CRON ENDPOINT] Manual cron execution failed:', error);
    
    return NextResponse.json({
      error: 'Manual cron execution failed',
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}