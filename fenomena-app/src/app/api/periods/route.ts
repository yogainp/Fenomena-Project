import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  try {
    requireAuth(request);

    const periods = await prisma.surveyPeriod.findMany({
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    return NextResponse.json(periods);
  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Get periods error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}