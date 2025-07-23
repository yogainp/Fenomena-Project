import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/middleware';
import { z } from 'zod';

const regionSchema = z.object({
  province: z.string().min(1, 'Province is required'),
  city: z.string().min(1, 'City is required'),
  regionCode: z.string().min(1, 'Region code is required'),
});

// GET /api/admin/regions - List all regions
export async function GET(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const province = searchParams.get('province') || '';

    const skip = (page - 1) * limit;

    // Build where conditions
    const whereConditions: any = {};
    
    if (search) {
      whereConditions.OR = [
        { city: { contains: search, mode: 'insensitive' } },
        { province: { contains: search, mode: 'insensitive' } },
        { regionCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (province) {
      whereConditions.province = { contains: province, mode: 'insensitive' };
    }

    // Get regions with pagination
    const [regions, totalRegions] = await Promise.all([
      prisma.region.findMany({
        where: whereConditions,
        include: {
          _count: {
            select: {
              users: true,
              phenomena: true,
            },
          },
        },
        orderBy: [
          { province: 'asc' },
          { city: 'asc' },
        ],
        skip,
        take: limit,
      }),
      prisma.region.count({ where: whereConditions }),
    ]);

    const totalPages = Math.ceil(totalRegions / limit);

    return NextResponse.json({
      regions: regions.map(region => ({
        ...region,
        userCount: region._count.users,
        phenomenaCount: region._count.phenomena,
        _count: undefined,
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalRegions,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });

  } catch (error: any) {
    console.error('Get regions error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/regions - Create new region
export async function POST(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    const body = await request.json();
    const validationResult = regionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      }, { status: 400 });
    }

    const { province, city, regionCode } = validationResult.data;

    // Check if region code already exists
    const existingRegion = await prisma.region.findUnique({
      where: { regionCode },
    });

    if (existingRegion) {
      return NextResponse.json({
        error: 'Region with this code already exists',
      }, { status: 409 });
    }

    // Create region
    const newRegion = await prisma.region.create({
      data: {
        province,
        city,
        regionCode,
      },
      include: {
        _count: {
          select: {
            users: true,
            phenomena: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: 'Region created successfully',
      region: {
        ...newRegion,
        userCount: newRegion._count.users,
        phenomenaCount: newRegion._count.phenomena,
        _count: undefined,
      },
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create region error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}