import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/middleware';
import { z } from 'zod';

const createKeywordSchema = z.object({
  keyword: z.string().min(1, 'Keyword cannot be empty').max(100, 'Keyword too long'),
  isActive: z.boolean().optional().default(true),
  category: z.string().max(50, 'Category too long').optional(),
  description: z.string().max(255, 'Description too long').optional(),
});

const updateKeywordSchema = z.object({
  keyword: z.string().min(1, 'Keyword cannot be empty').max(100, 'Keyword too long').optional(),
  isActive: z.boolean().optional(),
  category: z.string().max(50, 'Category too long').optional(),
  description: z.string().max(255, 'Description too long').optional(),
});

// GET /api/admin/scrapping-keywords - List all keywords
export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/admin/scrapping-keywords - Starting...');
    
    // Check authentication
    const user = requireRole(request, 'ADMIN');
    console.log('✓ User authenticated:', user.userId, user.role);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const activeOnly = searchParams.get('activeOnly') === 'true';

    console.log('Request parameters:', { page, limit, search, category, activeOnly });

    const skip = (page - 1) * limit;

    // Build where conditions
    const whereConditions: any = {};
    
    if (search) {
      whereConditions.OR = [
        { keyword: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      whereConditions.category = { contains: category, mode: 'insensitive' };
    }

    if (activeOnly) {
      whereConditions.isActive = true;
    }

    console.log('Where conditions:', JSON.stringify(whereConditions, null, 2));

    // Get keywords with individual error handling
    let keywords = [];
    let totalKeywords = 0;
    
    try {
      console.log('Fetching keywords...');
      keywords = await prisma.scrappingKeyword.findMany({
        where: whereConditions,
        orderBy: [
          { isActive: 'desc' },
          { matchCount: 'desc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: limit,
      });
      console.log('✓ Keywords fetched:', keywords.length);
    } catch (err) {
      console.error('Error fetching keywords:', err);
      keywords = [];
    }
    
    try {
      console.log('Counting total keywords...');
      totalKeywords = await prisma.scrappingKeyword.count({ where: whereConditions });
      console.log('✓ Total keywords counted:', totalKeywords);
    } catch (err) {
      console.error('Error counting keywords:', err);
      totalKeywords = 0;
    }

    const totalPages = Math.ceil(totalKeywords / limit);

    const response = {
      keywords,
      pagination: {
        currentPage: page,
        totalPages,
        totalKeywords,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };

    console.log('✓ Returning response:', JSON.stringify(response, null, 2));
    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Get keywords error:', error);
    console.error('Error stack:', error.stack);
    
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}

// POST /api/admin/scrapping-keywords - Create new keyword
export async function POST(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    const body = await request.json();
    const validationResult = createKeywordSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      }, { status: 400 });
    }

    const { keyword, isActive, category, description } = validationResult.data;

    // Check if keyword already exists
    const existingKeyword = await prisma.scrappingKeyword.findUnique({
      where: { keyword: keyword.toLowerCase().trim() },
    });

    if (existingKeyword) {
      return NextResponse.json({
        error: 'Keyword already exists',
      }, { status: 409 });
    }

    // Create keyword
    const newKeyword = await prisma.scrappingKeyword.create({
      data: {
        keyword: keyword.toLowerCase().trim(),
        isActive,
        category: category?.trim() || null,
        description: description?.trim() || null,
      },
    });

    return NextResponse.json({
      message: 'Keyword created successfully',
      keyword: newKeyword,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create keyword error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/scrapping-keywords - Bulk update keywords (activate/deactivate)
export async function PUT(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    const body = await request.json();
    const { keywordIds, updates } = body;

    if (!Array.isArray(keywordIds) || keywordIds.length === 0) {
      return NextResponse.json({
        error: 'keywordIds must be a non-empty array',
      }, { status: 400 });
    }

    const validationResult = updateKeywordSchema.safeParse(updates);
    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      }, { status: 400 });
    }

    // Update keywords
    const updatedKeywords = await prisma.scrappingKeyword.updateMany({
      where: {
        id: { in: keywordIds },
      },
      data: validationResult.data,
    });

    return NextResponse.json({
      message: `Updated ${updatedKeywords.count} keywords successfully`,
      updatedCount: updatedKeywords.count,
    });

  } catch (error: any) {
    console.error('Bulk update keywords error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}