import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  try {
    // Optional auth - allow access even without authentication
    // This is for public pages like insight-fenomena
    try {
      requireAuth(request);
    } catch (authError) {
      // Continue without auth for public access
      console.log('No auth provided, allowing public access to categories');
    }

    const categories = await prisma.surveyCategory.findMany({
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(categories);
  } catch (error: any) {
    console.error('Get categories error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}