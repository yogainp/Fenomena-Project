import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/middleware';
import { schedulerService } from '@/lib/scheduler-service';

// POST /api/admin/manage-scraping/init - Initialize scheduler service
export async function POST(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    await schedulerService.initialize();

    const activeJobsCount = schedulerService.getActiveJobsCount();

    return NextResponse.json({
      message: 'Scheduler service initialized successfully',
      activeJobs: activeJobsCount
    });

  } catch (error: any) {
    console.error('Initialize scheduler error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ 
      error: 'Failed to initialize scheduler service',
      details: error.message 
    }, { status: 500 });
  }
}

// GET /api/admin/manage-scraping/init - Get scheduler status
export async function GET(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    const activeJobsCount = schedulerService.getActiveJobsCount();

    return NextResponse.json({
      initialized: activeJobsCount >= 0,
      activeJobs: activeJobsCount
    });

  } catch (error: any) {
    console.error('Get scheduler status error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ 
      error: 'Failed to get scheduler status',
      details: error.message 
    }, { status: 500 });
  }
}