import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    console.log('News overview request by user:', user.userId);

    // Get basic counts
    const totalBerita = await prisma.scrappingBerita.count();
    
    // Get today's news count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const todayBerita = await prisma.scrappingBerita.count({
      where: {
        tanggalScrap: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // Get total active keywords
    const totalActiveKeywords = await prisma.scrappingKeyword.count({
      where: { isActive: true },
    });

    // Get total keywords (active + inactive)
    const totalKeywords = await prisma.scrappingKeyword.count();

    console.log('Basic counts:', { totalBerita, todayBerita, totalActiveKeywords, totalKeywords });

    // Get portal distribution
    const portalData = await prisma.scrappingBerita.groupBy({
      by: ['portalBerita'],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });

    const portalAnalysis = portalData.map(portal => ({
      portalName: portal.portalBerita,
      count: portal._count.id,
    }));

    // Get daily trend for the last 30 days based on publish date
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyData = await prisma.scrappingBerita.findMany({
      select: {
        tanggalBerita: true,
      },
      where: {
        tanggalBerita: {
          gte: thirtyDaysAgo,
        },
      },
    });

    // Group by publish date
    const dailyGrouped: { [key: string]: number } = {};
    dailyData.forEach(berita => {
      const dateKey = berita.tanggalBerita.toISOString().split('T')[0];
      dailyGrouped[dateKey] = (dailyGrouped[dateKey] || 0) + 1;
    });

    const dailyTrend = Object.entries(dailyGrouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get top matched keywords
    const keywordData = await prisma.scrappingKeyword.findMany({
      select: {
        keyword: true,
        matchCount: true,
      },
      where: {
        matchCount: { gt: 0 },
      },
      orderBy: {
        matchCount: 'desc',
      },
      take: 15,
    });

    const topKeywords = keywordData.map(keyword => ({
      keyword: keyword.keyword,
      count: keyword.matchCount,
    }));

    // Get recent articles by publish date (last 10 articles)
    const recentActivity = await prisma.scrappingBerita.findMany({
      select: {
        id: true,
        judul: true,
        portalBerita: true,
        tanggalBerita: true,
        matchedKeywords: true,
      },
      orderBy: {
        tanggalBerita: 'desc',
      },
      take: 10,
    });

    // Get keyword effectiveness (match rate)
    const allKeywords = await prisma.scrappingKeyword.findMany({
      select: {
        keyword: true,
        matchCount: true,
        isActive: true,
      },
    });

    const activeKeywordsWithMatches = allKeywords.filter(k => k.isActive && k.matchCount > 0).length;
    const keywordEffectiveness = totalActiveKeywords > 0 ? 
      Math.round((activeKeywordsWithMatches / totalActiveKeywords) * 100) : 0;

    // Calculate average articles per day
    const avgArticlesPerDay = dailyTrend.length > 0 ? 
      Math.round(dailyTrend.reduce((sum, day) => sum + day.count, 0) / dailyTrend.length) : 0;

    const result = {
      overview: {
        totalBerita,
        todayBerita,
        totalPortals: portalData.length,
        totalActiveKeywords,
        totalKeywords,
        keywordEffectiveness,
        avgArticlesPerDay,
      },
      portalAnalysis,
      dailyTrend,
      topKeywords,
      recentActivity: recentActivity.map(activity => ({
        id: activity.id,
        judul: activity.judul,
        portalBerita: activity.portalBerita,
        tanggalBerita: activity.tanggalBerita.toISOString(),
        matchedKeywords: activity.matchedKeywords,
      })),
    };

    console.log('Returning news overview data:', result);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('News overview error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}