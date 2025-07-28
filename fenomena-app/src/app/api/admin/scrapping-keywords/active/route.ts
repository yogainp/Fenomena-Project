import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/middleware';

// GET /api/admin/scrapping-keywords/active - Get all active keywords
export async function GET(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || '';

    // Build where conditions
    const whereConditions: any = {
      isActive: true,
    };
    
    if (category) {
      whereConditions.category = { contains: category, mode: 'insensitive' };
    }

    // Get active keywords
    const activeKeywords = await prisma.scrappingKeyword.findMany({
      where: whereConditions,
      select: {
        id: true,
        keyword: true,
        category: true,
        description: true,
        matchCount: true,
      },
      orderBy: [
        { matchCount: 'desc' },
        { keyword: 'asc' }
      ],
    });

    return NextResponse.json({
      keywords: activeKeywords,
      total: activeKeywords.length,
    });

  } catch (error: any) {
    console.error('Get active keywords error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}