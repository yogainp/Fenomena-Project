import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/middleware';

export async function POST(request: NextRequest) {
  try {
    const user = requireRole(request, 'ADMIN');
    const body = await request.json();
    
    const { categoryId, periodId } = body;
    
    // Validate required fields
    if (!categoryId || !periodId) {
      return NextResponse.json(
        { error: 'CategoryId dan periodId harus diisi' },
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
    
    // Check existing data
    const existingData = await prisma.catatanSurvei.findMany({
      where: {
        categoryId,
        periodId,
      },
      include: {
        user: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1, // Get the most recent record to show who uploaded last
    });
    
    const existingCount = await prisma.catatanSurvei.count({
      where: {
        categoryId,
        periodId,
      },
    });
    
    // Get regions distribution
    const regionDistribution = await prisma.catatanSurvei.groupBy({
      by: ['regionId'],
      where: {
        categoryId,
        periodId,
      },
      _count: {
        id: true,
      },
    });
    
    // Get region details for the distribution
    const regionIds = regionDistribution.map(r => r.regionId);
    const regions = await prisma.region.findMany({
      where: {
        id: {
          in: regionIds,
        },
      },
      select: {
        id: true,
        province: true,
        city: true,
      },
    });
    
    const regionMap = new Map(regions.map(r => [r.id, r]));
    const regionStats = regionDistribution.map(r => ({
      region: regionMap.get(r.regionId),
      count: r._count.id,
    }));
    
    return NextResponse.json({
      hasExistingData: existingCount > 0,
      existingCount,
      lastUploadedBy: existingData[0]?.user.username || null,
      lastUploadedAt: existingData[0]?.createdAt || null,
      categoryName: category.name,
      periodName: period.name,
      regionStats,
    });
    
  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Check existing data error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}