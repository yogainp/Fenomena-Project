import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('Test analytics API called');

    // Simple test - just get counts using Supabase
    const [
      { count: totalPhenomena },
      { count: totalCategories }
    ] = await Promise.all([
      supabase.from('phenomena').select('*', { count: 'exact', head: true }),
      supabase.from('survey_categories').select('*', { count: 'exact', head: true })
    ]);
    
    console.log('Test counts:', { totalPhenomena, totalCategories });

    // Get some sample data
    const { data: categories } = await supabase
      .from('survey_categories')
      .select('id, name')
      .limit(5);

    const { data: phenomena } = await supabase
      .from('phenomena')
      .select('id, title, categoryId')
      .limit(5);

    console.log('Test data fetched successfully');

    return NextResponse.json({
      status: 'success',
      totalPhenomena: totalPhenomena || 0,
      totalCategories: totalCategories || 0,
      sampleCategories: categories || [],
      samplePhenomena: phenomena || [],
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Test analytics error:', error);
    return NextResponse.json({ 
      error: 'Test failed', 
      details: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}