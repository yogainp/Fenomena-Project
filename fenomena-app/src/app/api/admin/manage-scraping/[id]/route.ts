import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/middleware';
import { schedulerService, AVAILABLE_PORTALS } from '@/lib/scheduler-service';
import { z } from 'zod';

// Validation schema for updating schedules
const updateScheduleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  portalUrl: z.string().url('Invalid portal URL').refine(
    (url) => AVAILABLE_PORTALS.some(portal => portal.url === url),
    {
      message: `Portal URL must be one of: ${AVAILABLE_PORTALS.map(p => p.url).join(', ')}`
    }
  ).optional(),
  maxPages: z.number().min(1).max(200).optional(),
  delayMs: z.number().min(1000).max(10000).optional(),
  cronSchedule: z.string().min(1, 'Cron schedule is required').optional(),
  isActive: z.boolean().optional(),
});

interface RouteParams {
  params: {
    id: string;
  };
}

// GET /api/admin/manage-scraping/[id] - Get specific schedule
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    requireRole(request, 'ADMIN');

    const { id } = params;
    const schedules = await schedulerService.getAllSchedules();
    const schedule = schedules.find(s => s.id === id);

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    return NextResponse.json({ schedule });

  } catch (error: any) {
    console.error('Get schedule error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/manage-scraping/[id] - Update specific schedule
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    requireRole(request, 'ADMIN');

    const { id } = params;
    const body = await request.json();
    
    const validationResult = updateScheduleSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      }, { status: 400 });
    }

    const updateData = validationResult.data;

    // Validate cron expression if provided
    if (updateData.cronSchedule) {
      const cron = await import('node-cron');
      if (!cron.validate(updateData.cronSchedule)) {
        return NextResponse.json({
          error: 'Invalid cron expression'
        }, { status: 400 });
      }
    }

    const updatedSchedule = await schedulerService.updateSchedule(id, updateData);

    return NextResponse.json({
      message: 'Schedule updated successfully',
      schedule: updatedSchedule
    });

  } catch (error: any) {
    console.error('Update schedule error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message.includes('Record to update not found')) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/manage-scraping/[id] - Delete specific schedule
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    requireRole(request, 'ADMIN');

    const { id } = params;
    await schedulerService.deleteSchedule(id);

    return NextResponse.json({
      message: 'Schedule deleted successfully'
    });

  } catch (error: any) {
    console.error('Delete schedule error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message.includes('Record to delete does not exist')) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}