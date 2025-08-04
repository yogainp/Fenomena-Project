import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    console.log('Simple analytics request by user:', user.userId);

    // Get basic counts first
    const totalPhenomena = await prisma.phenomenon.count();
    const totalCategories = await prisma.surveyCategory.count();
    const totalUsers = await prisma.user.count();
    const totalRegions = await prisma.region.count();
    
    // Count unique periods from categories
    const categoriesWithPeriods = await prisma.surveyCategory.findMany({
      select: { periodeSurvei: true },
      where: { periodeSurvei: { not: null } }
    });
    const totalPeriods = new Set(categoriesWithPeriods.map(c => c.periodeSurvei)).size;

    console.log('Basic counts:', { totalPhenomena, totalCategories, totalPeriods, totalUsers, totalRegions });

    // Get category distribution
    const categoryData = await prisma.surveyCategory.findMany({
      include: {
        _count: {
          select: {
            phenomena: true,
          },
        },
      },
    });

    const categoryAnalysis = categoryData.map(category => ({
      categoryId: category.id,
      name: category.name,
      count: category._count.phenomena,
    }));

    // Get period distribution from categories
    const categoriesWithPhenomenaCount = await prisma.surveyCategory.findMany({
      include: {
        _count: {
          select: {
            phenomena: true,
          },
        },
      },
      where: {
        periodeSurvei: { not: null }
      }
    });

    // Group by period name and sum phenomena counts
    const periodMap: { [key: string]: number } = {};
    categoriesWithPhenomenaCount.forEach(category => {
      if (category.periodeSurvei) {
        periodMap[category.periodeSurvei] = (periodMap[category.periodeSurvei] || 0) + category._count.phenomena;
      }
    });

    const periodAnalysis = Object.entries(periodMap).map(([periodName, count]) => ({
      periodId: periodName,
      name: periodName,
      count: count,
    }));

    // Get user contributions
    const userData = await prisma.user.findMany({
      include: {
        _count: {
          select: {
            phenomena: true,
          },
        },
      },
      orderBy: {
        phenomena: {
          _count: 'desc',
        },
      },
      take: 5,
    });

    const userContributions = userData.map(user => ({
      userId: user.id,
      username: user.username,
      count: user._count.phenomena,
    }));

    // Get region distribution
    const regionData = await prisma.region.findMany({
      include: {
        _count: {
          select: {
            phenomena: true,
          },
        },
      },
    });

    const regionAnalysis = regionData.map(region => ({
      regionId: region.id,
      province: region.province,
      city: region.city,
      regionCode: region.regionCode,
      count: region._count.phenomena,
    }));

    // Simple monthly trend - get phenomena with dates
    const phenomenaWithDates = await prisma.phenomenon.findMany({
      select: {
        createdAt: true,
      },
    });

    // Group by month
    const monthlyData: { [key: string]: number } = {};
    phenomenaWithDates.forEach(phenomenon => {
      const monthKey = new Date(phenomenon.createdAt).toISOString().slice(0, 7);
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
    });

    const monthlyTrend = Object.entries(monthlyData)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const result = {
      overview: {
        totalPhenomena,
        totalCategories,
        totalPeriods,
        totalUsers,
        totalRegions,
      },
      categoryAnalysis,
      periodAnalysis,
      regionAnalysis,
      monthlyTrend,
      userContributions,
    };

    console.log('Returning analytics data:', result);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Simple analytics error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}