import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  try {
    requireAuth(request);

    // Get period data from survey_categories that have period information
    const periods = await prisma.surveyCategory.findMany({
      where: {
        AND: [
          { periodeSurvei: { not: null } },
          { startDate: { not: null } },
          { endDate: { not: null } }
        ]
      },
      select: {
        id: true,
        periodeSurvei: true,
        startDate: true,
        endDate: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    // Transform to match expected Period interface
    const transformedPeriods = periods.map(period => ({
      id: period.id,
      name: period.periodeSurvei,
      startDate: period.startDate,
      endDate: period.endDate,
    }));

    return NextResponse.json(transformedPeriods);
  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Get periods error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}