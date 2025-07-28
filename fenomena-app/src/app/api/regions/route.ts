import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

// GET /api/regions - Get all regions for dropdown selection
export async function GET(request: NextRequest) {
  try {
    requireAuth(request); // Any authenticated user can access

    const regions = await prisma.region.findMany({
      select: {
        id: true,
        province: true,
        city: true,
        regionCode: true,
      },
      orderBy: [
        { province: 'asc' },
        { city: 'asc' },
      ],
    });

    // Transform data to include 'name' field for frontend compatibility
    const transformedRegions = regions.map(region => ({
      id: region.id,
      name: `${region.province} - ${region.city}`,
      code: region.regionCode,
      province: region.province,
      city: region.city,
    }));

    return NextResponse.json(transformedRegions);

  } catch (error: any) {
    console.error('Get regions error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}