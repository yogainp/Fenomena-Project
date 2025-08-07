import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    console.log('News overview request by user:', user.userId);

    // Get total news count
    const { count: totalBerita, error: totalError } = await supabase
      .from('scrapping_berita')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      console.error('Error getting total berita:', totalError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    
    // Get today's news count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const { count: todayBerita, error: todayError } = await supabase
      .from('scrapping_berita')
      .select('*', { count: 'exact', head: true })
      .gte('tanggalScrap', today.toISOString())
      .lt('tanggalScrap', tomorrow.toISOString());

    if (todayError) {
      console.error('Error getting today berita:', todayError);
    }

    // Get total active keywords
    const { count: totalActiveKeywords, error: activeError } = await supabase
      .from('scrapping_keyword')
      .select('*', { count: 'exact', head: true })
      .eq('isActive', true);

    if (activeError) {
      console.error('Error getting active keywords:', activeError);
    }

    // Get total keywords (active + inactive)
    const { count: totalKeywords, error: keywordError } = await supabase
      .from('scrapping_keyword')
      .select('*', { count: 'exact', head: true });

    if (keywordError) {
      console.error('Error getting total keywords:', keywordError);
    }

    console.log('Basic counts:', { totalBerita, todayBerita, totalActiveKeywords, totalKeywords });

    // Get portal distribution - we'll need to fetch all and group manually since Supabase doesn't have groupBy
    const { data: allBerita, error: portalError } = await supabase
      .from('scrapping_berita')
      .select('portalBerita');

    if (portalError) {
      console.error('Error getting portal data:', portalError);
    }

    // Group by portal manually
    const portalCounts: { [key: string]: number } = {};
    (allBerita || []).forEach(berita => {
      portalCounts[berita.portalBerita] = (portalCounts[berita.portalBerita] || 0) + 1;
    });

    const portalAnalysis = Object.entries(portalCounts)
      .map(([portalName, count]) => ({ portalName, count }))
      .sort((a, b) => b.count - a.count);

    // Get daily trend for the last 30 days based on publish date
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: dailyData, error: dailyError } = await supabase
      .from('scrapping_berita')
      .select('tanggalBerita')
      .gte('tanggalBerita', thirtyDaysAgo.toISOString());

    if (dailyError) {
      console.error('Error getting daily data:', dailyError);
    }

    // Group by publish date
    const dailyGrouped: { [key: string]: number } = {};
    (dailyData || []).forEach(berita => {
      const dateKey = new Date(berita.tanggalBerita).toISOString().split('T')[0];
      dailyGrouped[dateKey] = (dailyGrouped[dateKey] || 0) + 1;
    });

    const dailyTrend = Object.entries(dailyGrouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get top matched keywords
    const { data: keywordData, error: keywordMatchError } = await supabase
      .from('scrapping_keyword')
      .select('keyword, matchCount')
      .gt('matchCount', 0)
      .order('matchCount', { ascending: false })
      .limit(15);

    if (keywordMatchError) {
      console.error('Error getting keyword data:', keywordMatchError);
    }

    const topKeywords = (keywordData || []).map(keyword => ({
      keyword: keyword.keyword,
      count: keyword.matchCount,
    }));

    // Get recent articles by publish date (last 10 articles)
    const { data: recentActivity, error: recentError } = await supabase
      .from('scrapping_berita')
      .select('id, judul, portalBerita, tanggalBerita, matchedKeywords')
      .order('tanggalBerita', { ascending: false })
      .limit(10);

    if (recentError) {
      console.error('Error getting recent activity:', recentError);
    }

    // Get all keywords for effectiveness calculation
    const { data: allKeywords, error: allKeywordsError } = await supabase
      .from('scrapping_keyword')
      .select('keyword, matchCount, isActive');

    if (allKeywordsError) {
      console.error('Error getting all keywords:', allKeywordsError);
    }

    const activeKeywordsWithMatches = (allKeywords || []).filter(k => k.isActive && k.matchCount > 0).length;
    const keywordEffectiveness = (totalActiveKeywords || 0) > 0 ? 
      Math.round((activeKeywordsWithMatches / (totalActiveKeywords || 1)) * 100) : 0;

    // Calculate average articles per day
    const avgArticlesPerDay = dailyTrend.length > 0 ? 
      Math.round(dailyTrend.reduce((sum, day) => sum + day.count, 0) / dailyTrend.length) : 0;

    const result = {
      overview: {
        totalBerita: totalBerita || 0,
        todayBerita: todayBerita || 0,
        totalPortals: portalAnalysis.length,
        totalActiveKeywords: totalActiveKeywords || 0,
        totalKeywords: totalKeywords || 0,
        keywordEffectiveness,
        avgArticlesPerDay,
      },
      portalAnalysis,
      dailyTrend,
      topKeywords,
      recentActivity: (recentActivity || []).map(activity => ({
        id: activity.id,
        judul: activity.judul,
        portalBerita: activity.portalBerita,
        tanggalBerita: activity.tanggalBerita,
        matchedKeywords: activity.matchedKeywords || [],
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