import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireRole } from '@/lib/middleware';

export async function POST(request: NextRequest) {
  try {
    console.log('=== Check Existing API Called ===');
    const user = requireRole(request, 'ADMIN');
    console.log('User authenticated:', user);
    const body = await request.json();
    console.log('Request body:', body);
    
    const { categoryId } = body;
    
    // Validate required fields
    if (!categoryId) {
      return NextResponse.json(
        { error: 'CategoryId harus diisi' },
        { status: 400 }
      );
    }
    
    // Validate category exists
    console.log('Finding category with ID:', categoryId);
    const category = await prisma.surveyCategory.findUnique({
      where: { id: categoryId },
    });
    console.log('Category found:', category);
    
    if (!category) {
      console.log('Category not found for ID:', categoryId);
      return NextResponse.json(
        { error: 'Kategori tidak ditemukan' },
        { status: 400 }
      );
    }
    
    
    // Check existing data
    const existingData = await prisma.catatanSurvei.findMany({
      where: {
        categoryId,
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
      },
    });
    
    // Get regions distribution
    const regionDistribution = await prisma.catatanSurvei.groupBy({
      by: ['regionId'],
      where: {
        categoryId,
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
      regionStats,
    });
    
  } catch (error: any) {
    console.error('=== Check Existing API Error ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error:', error);
    
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Check existing data error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}