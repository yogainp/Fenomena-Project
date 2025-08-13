import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Get auth token from cookie
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify token
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    console.log('Analytics request by user:', user.userId);

    // Get basic statistics using Supabase
    const [
      phenomenaCount,
      categoriesCount, 
      usersCount,
      phenomenaData,
      categoriesData,
      usersData
    ] = await Promise.all([
      // Total counts
      supabase.from('phenomena').select('*', { count: 'exact', head: true }),
      supabase.from('survey_categories').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      
      // Get phenomena with relations for analysis
      supabase.from('phenomena').select(`
        id,
        categoryId,
        userId,
        createdAt,
        category:survey_categories(id, name),
        user:users(id, username)
      `),
      
      // Get categories
      supabase.from('survey_categories').select('id, name'),
      
      // Get users  
      supabase.from('users').select('id, username')
    ]);

    if (phenomenaData.error || categoriesData.error || usersData.error) {
      console.error('Database error:', {
        phenomena: phenomenaData.error,
        categories: categoriesData.error,
        users: usersData.error
      });
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const phenomena = phenomenaData.data || [];
    const categories = categoriesData.data || [];
    const users = usersData.data || [];

    // Process phenomena by category
    const categoryMap = new Map();
    phenomena.forEach(p => {
      const categoryId = p.categoryId;
      categoryMap.set(categoryId, (categoryMap.get(categoryId) || 0) + 1);
    });

    const categoryAnalysis = Array.from(categoryMap.entries()).map(([categoryId, count]) => {
      const category = categories.find(c => c.id === categoryId);
      return {
        categoryId,
        name: category?.name || 'Unknown',
        count
      };
    });

    // Process phenomena by user
    const userMap = new Map();
    phenomena.forEach(p => {
      const userId = p.userId;
      userMap.set(userId, (userMap.get(userId) || 0) + 1);
    });

    const userAnalysis = Array.from(userMap.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([userId, count]) => {
        const user = users.find(u => u.id === userId);
        return {
          userId,
          username: user?.username || 'Unknown',
          count
        };
      });

    // Process monthly trend data (this year only)
    const currentYear = new Date().getFullYear();
    const monthlyTrendProcessed = phenomena
      .filter(p => new Date((p as any).createdAt).getFullYear() === currentYear)
      .reduce((acc: { [key: string]: number }, phenomenon) => {
        const month = new Date((phenomenon as any).createdAt).toISOString().slice(0, 7); // YYYY-MM format
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {});

    const monthlyTrendArray = Object.entries(monthlyTrendProcessed).map(([month, count]) => ({
      month,
      count,
    })).sort((a, b) => a.month.localeCompare(b.month));

    console.log('Analytics data prepared:', {
      totalPhenomena: phenomenaCount.count,
      categoriesCount: categoryAnalysis.length,
      monthlyCount: monthlyTrendArray.length,
      usersCount: userAnalysis.length
    });

    return NextResponse.json({
      overview: {
        totalPhenomena: phenomenaCount.count || 0,
        totalCategories: categoriesCount.count || 0,
        totalUsers: usersCount.count || 0,
      },
      categoryAnalysis,
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