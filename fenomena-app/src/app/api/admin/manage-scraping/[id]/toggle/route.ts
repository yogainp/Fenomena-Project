import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/middleware';
import { schedulerService } from '@/lib/scheduler-service';

interface RouteParams {
  params: {
    id: string;
  };
}

// POST /api/admin/manage-scraping/[id]/toggle - Toggle schedule active status
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    requireRole(request, 'ADMIN');

    const { id } = params;
    const updatedSchedule = await schedulerService.toggleSchedule(id);

    return NextResponse.json({
      message: `Schedule ${updatedSchedule.isActive ? 'activated' : 'deactivated'} successfully`,
      schedule: updatedSchedule
    });

  } catch (error: any) {
    console.error('Toggle schedule error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message.includes('not found')) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}