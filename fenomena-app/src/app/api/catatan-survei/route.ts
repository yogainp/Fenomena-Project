import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  try {
    const user = requireRole(request, 'ADMIN');
    
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
    
    // Since this is admin-only, show all data
    
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
    const user = requireRole(request, 'ADMIN');
    const body = await request.json();
    
    const { catatan, regionId, categoryId, nomorResponden } = body;
    
    // Validate required fields
    if (!catatan || !regionId || !categoryId || nomorResponden === undefined) {
      return NextResponse.json(
        { error: 'Catatan, regionId, categoryId, dan nomorResponden harus diisi' },
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
    
    // Admin can add to any region
    
    // Generate respondenId (without periodId)
    const respondenId = `${categoryId}-${nomorRespondenInt}`;
    
    const catatanSurvei = await prisma.catatanSurvei.create({
      data: {
        nomorResponden: nomorRespondenInt,
        respondenId,
        catatan,
        regionId,
        categoryId,
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