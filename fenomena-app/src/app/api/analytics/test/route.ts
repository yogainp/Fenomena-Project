import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    console.log('Test analytics API called');

    // Simple test - just get counts
    const totalPhenomena = await prisma.phenomenon.count();
    const totalCategories = await prisma.surveyCategory.count();
    
    console.log('Test counts:', { totalPhenomena, totalCategories });

    // Get some sample data
    const categories = await prisma.surveyCategory.findMany({
      select: {
        id: true,
        name: true,
      },
      take: 5,
    });

    const phenomena = await prisma.phenomenon.findMany({
      select: {
        id: true,
        title: true,
        categoryId: true,
      },
      take: 5,
    });

    console.log('Test data fetched successfully');

    return NextResponse.json({
      status: 'success',
      totalPhenomena,
      totalCategories,
      sampleCategories: categories,
      samplePhenomena: phenomena,
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