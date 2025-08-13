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

    // Get period data from survey_categories
    const { data: periods, error } = await supabase
      .from('survey_categories')
      .select('*')
      .not('periodeSurvei', 'is', null)
      .not('startDate', 'is', null)
      .not('endDate', 'is', null)
      .order('startDate', { ascending: false });

    if (error) {
      console.error('Error fetching periods:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Process data to match expected period format
    const processedPeriods = (periods || []).map((period: any) => ({
      id: period.id,
      name: period.name,
      periodeSurvei: period.periodeSurvei,
      startDate: period.startDate,
      endDate: period.endDate,
      isActive: new Date() >= new Date(period.startDate) && new Date() <= new Date(period.endDate),
      description: period.description || `${period.periodeSurvei} survey period`,
      phenomenaCount: 0 // Could be enhanced later with actual counts
    }));

    return NextResponse.json({ periods: processedPeriods });

  } catch (error: any) {
    console.error('Get periods error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}