import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const regionId = searchParams.get('regionId') || '';
    
    const skip = (page - 1) * limit;
    
    // Build where conditions
    const whereConditions: any = {};
    
    if (search) {
      whereConditions.catatan = {
        contains: search,
        mode: 'insensitive'
      };
    }
    
    if (categoryId) {
      whereConditions.categoryId = categoryId;
    }
    
    if (regionId) {
      whereConditions.regionId = regionId;
    }
    
    // If user is not admin, only show their own data
    if (user.role !== 'ADMIN') {
      if (user.regionId) {
        whereConditions.regionId = user.regionId;
      } else {
        whereConditions.userId = user.userId;
      }
    }
    
    const [catatanSurvei, totalCount] = await Promise.all([
      prisma.catatanSurvei.findMany({
        where: whereConditions,
        include: {
          region: {
            select: {
              id: true,
              province: true,
              city: true,
              regionCode: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          period: {
            select: {
              id: true,
              name: true,
              startDate: true,
              endDate: true,
            },
          },
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
        orderBy: [
          {
            nomorResponden: 'asc',
          },
          {
            createdAt: 'desc',
          },
        ],
        skip,
        take: limit,
      }),
      prisma.catatanSurvei.count({
        where: whereConditions,
      }),
    ]);
    
    return NextResponse.json({
      data: catatanSurvei,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
    
  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Get catatan survei error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const body = await request.json();
    
    const { catatan, regionId, categoryId, periodId, nomorResponden } = body;
    
    // Validate required fields
    if (!catatan || !regionId || !categoryId || !periodId || nomorResponden === undefined) {
      return NextResponse.json(
        { error: 'Catatan, regionId, categoryId, periodId, dan nomorResponden harus diisi' },
        { status: 400 }
      );
    }
    
    // Convert and validate nomorResponden as integer
    const nomorRespondenInt = parseInt(nomorResponden, 10);
    if (isNaN(nomorRespondenInt) || nomorRespondenInt <= 0) {
      return NextResponse.json(
        { error: 'Nomor responden harus berupa angka positif' },
        { status: 400 }
      );
    }
    
    // Validate region exists
    const region = await prisma.region.findUnique({
      where: { id: regionId },
    });
    
    if (!region) {
      return NextResponse.json(
        { error: 'Region tidak ditemukan' },
        { status: 400 }
      );
    }
    
    // Validate category exists
    const category = await prisma.surveyCategory.findUnique({
      where: { id: categoryId },
    });
    
    if (!category) {
      return NextResponse.json(
        { error: 'Kategori tidak ditemukan' },
        { status: 400 }
      );
    }
    
    // Validate period exists
    const period = await prisma.surveyPeriod.findUnique({
      where: { id: periodId },
    });
    
    if (!period) {
      return NextResponse.json(
        { error: 'Periode tidak ditemukan' },
        { status: 400 }
      );
    }
    
    // Check if user can add to this region
    if (user.role !== 'ADMIN' && user.regionId && user.regionId !== regionId) {
      return NextResponse.json(
        { error: 'Anda tidak dapat menambah catatan untuk wilayah ini' },
        { status: 403 }
      );
    }
    
    // Generate respondenId  
    const respondenId = `${categoryId}-${periodId}-${nomorRespondenInt}`;
    
    const catatanSurvei = await prisma.catatanSurvei.create({
      data: {
        nomorResponden: nomorRespondenInt,
        respondenId,
        catatan,
        regionId,
        categoryId,
        periodId,
        userId: user.userId,
      },
      include: {
        region: {
          select: {
            id: true,
            province: true,
            city: true,
            regionCode: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        period: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
    
    return NextResponse.json(catatanSurvei, { status: 201 });
    
  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Create catatan survei error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}