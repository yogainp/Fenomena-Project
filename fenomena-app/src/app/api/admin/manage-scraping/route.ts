import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/middleware';
import { schedulerService, AVAILABLE_PORTALS } from '@/lib/scheduler-service';
import { z } from 'zod';

// Validation schema for creating/updating schedules
const scheduleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  portalUrl: z.string().url('Invalid portal URL').refine(
    (url) => AVAILABLE_PORTALS.some(portal => portal.url === url),
    {
      message: `Portal URL must be one of: ${AVAILABLE_PORTALS.map(p => p.url).join(', ')}`
    }
  ),
  maxPages: z.number().min(1).max(200).optional().default(5),
  delayMs: z.number().min(1000).max(10000).optional().default(2000),
  cronSchedule: z.string().min(1, 'Cron schedule is required'),
  isActive: z.boolean().optional().default(true),
});

// GET /api/admin/manage-scraping - Get all schedules
export async function GET(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    const schedules = await schedulerService.getAllSchedules();
    const activeJobsCount = schedulerService.getActiveJobsCount();

    return NextResponse.json({
      schedules,
      statistics: {
        totalSchedules: schedules.length,
        activeSchedules: schedules.filter(s => s.isActive).length,
        runningJobs: activeJobsCount
      }
    });

  } catch (error: any) {
    console.error('Get schedules error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/manage-scraping - Create new schedule
export async function POST(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    const body = await request.json();
    const validationResult = scheduleSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      }, { status: 400 });
    }

    const scheduleData = validationResult.data;

    // Validate cron expression
    const cron = await import('node-cron');
    if (!cron.validate(scheduleData.cronSchedule)) {
      return NextResponse.json({
        error: 'Invalid cron expression'
      }, { status: 400 });
    }

    const newSchedule = await schedulerService.addSchedule(scheduleData);

    return NextResponse.json({
      message: 'Schedule created successfully',
      schedule: newSchedule
    });

  } catch (error: any) {
    console.error('Create schedule error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Schedule name already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}