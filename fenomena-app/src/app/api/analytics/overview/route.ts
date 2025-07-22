import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    console.log('Analytics request by user:', user.userId);

    // Get basic statistics
    const [
      totalPhenomena,
      totalCategories,
      totalPeriods,
      totalUsers,
      phenomenaByCategory,
      phenomenaByPeriod,
      phenomenaByMonth,
      topUsers,
    ] = await Promise.all([
      // Total counts
      prisma.phenomenon.count(),
      prisma.surveyCategory.count(),
      prisma.surveyPeriod.count(),
      prisma.user.count(),
      
      // Phenomena by category
      prisma.phenomenon.groupBy({
        by: ['categoryId'],
        _count: {
          _all: true,
        },
      }),
      
      // Phenomena by period
      prisma.phenomenon.groupBy({
        by: ['periodId'],
        _count: {
          _all: true,
        },
      }),
      
      // Phenomena by month (created) - simplified query
      prisma.phenomenon.findMany({
        select: {
          createdAt: true,
        },
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), 0, 1), // This year
          },
        },
      }),
      
      // Top contributing users
      prisma.phenomenon.groupBy({
        by: ['userId'],
        _count: {
          _all: true,
        },
        orderBy: {
          _count: {
            _all: 'desc',
          },
        },
        take: 5,
      }),
    ]);

    // Get category and period details for the grouped data
    const categoryDetails = await prisma.surveyCategory.findMany({
      where: {
        id: {
          in: phenomenaByCategory.map(item => item.categoryId),
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const periodDetails = await prisma.surveyPeriod.findMany({
      where: {
        id: {
          in: phenomenaByPeriod.map(item => item.periodId),
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const userDetails = await prisma.user.findMany({
      where: {
        id: {
          in: topUsers.map(item => item.userId),
        },
      },
      select: {
        id: true,
        username: true,
      },
    });

    // Process monthly trend data
    const monthlyTrendProcessed = phenomenaByMonth.reduce((acc: { [key: string]: number }, phenomenon) => {
      const month = new Date(phenomenon.createdAt).toISOString().slice(0, 7); // YYYY-MM format
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});

    const monthlyTrendArray = Object.entries(monthlyTrendProcessed).map(([month, count]) => ({
      month,
      count,
    })).sort((a, b) => a.month.localeCompare(b.month));

    // Format the data for response
    const categoryAnalysis = phenomenaByCategory.map(item => ({
      categoryId: item.categoryId,
      name: categoryDetails.find(cat => cat.id === item.categoryId)?.name || 'Unknown',
      count: item._count._all,
    }));

    const periodAnalysis = phenomenaByPeriod.map(item => ({
      periodId: item.periodId,
      name: periodDetails.find(period => period.id === item.periodId)?.name || 'Unknown',
      count: item._count._all,
    }));

    const userAnalysis = topUsers.map(item => ({
      userId: item.userId,
      username: userDetails.find(user => user.id === item.userId)?.username || 'Unknown',
      count: item._count._all,
    }));

    console.log('Analytics data prepared:', {
      totalPhenomena,
      categoriesCount: categoryAnalysis.length,
      periodsCount: periodAnalysis.length,
      monthlyCount: monthlyTrendArray.length,
      usersCount: userAnalysis.length
    });

    return NextResponse.json({
      overview: {
        totalPhenomena,
        totalCategories,
        totalPeriods,
        totalUsers,
      },
      categoryAnalysis,
      periodAnalysis,
      monthlyTrend: monthlyTrendArray,
      userContributions: userAnalysis,
    });

  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Analytics overview error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}