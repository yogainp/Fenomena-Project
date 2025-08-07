import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Public access - no auth required
    const { data: categories, error } = await supabase
      .from('survey_categories')
      .select('id, name, description')
      .order('name', { ascending: true });

    if (error) {
      console.error('Categories fetch error:', error);
      return NextResponse.json({ 
        error: 'Database error',
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json(categories || []);
  } catch (error: any) {
    console.error('Get categories error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}