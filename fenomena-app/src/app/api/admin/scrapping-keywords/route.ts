import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireRole } from '@/lib/middleware';
import { z } from 'zod';
import { randomUUID } from 'crypto';

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
      
      // Build Supabase query
      let query = supabase
        .from('scrapping_keywords')
        .select('*', { count: 'exact' });

      // Apply filters
      if (search) {
        query = query.or(`keyword.ilike.%${search}%,description.ilike.%${search}%`);
      }
      if (category) {
        query = query.ilike('category', `%${category}%`);
      }
      if (activeOnly) {
        query = query.eq('isActive', true);
      }

      // Apply ordering and pagination
      query = query
        .order('isActive', { ascending: false })
        .order('matchCount', { ascending: false })
        .order('createdAt', { ascending: false })
        .range(skip, skip + limit - 1);

      const { data, error, count } = await query;
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      keywords = data || [];
      totalKeywords = count || 0;
      console.log('✓ Keywords fetched:', keywords.length, 'Total:', totalKeywords);
      
    } catch (err) {
      console.error('Error fetching keywords:', err);
      keywords = [];
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

    const keywordValue = keyword.toLowerCase().trim();
    
    // Check if keyword already exists
    const { data: existingKeyword } = await supabase
      .from('scrapping_keywords')
      .select('id')
      .eq('keyword', keywordValue)
      .single();

    if (existingKeyword) {
      return NextResponse.json({
        error: 'Keyword already exists',
      }, { status: 409 });
    }

    // Create keyword
    const { data: newKeyword, error: createError } = await supabase
      .from('scrapping_keywords')
      .insert({
        id: randomUUID(),
        keyword: keywordValue,
        isActive,
        category: category?.trim() || null,
        description: description?.trim() || null,
        matchCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();
      
    if (createError) {
      console.error('Error creating keyword:', createError);
      throw createError;
    }

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
    const { data: updatedKeywords, error: updateError } = await supabase
      .from('scrapping_keywords')
      .update({
        ...validationResult.data,
        updatedAt: new Date().toISOString()
      })
      .in('id', keywordIds)
      .select();
      
    if (updateError) {
      console.error('Error updating keywords:', updateError);
      throw updateError;
    }

    return NextResponse.json({
      message: `Updated ${updatedKeywords?.length || 0} keywords successfully`,
      updatedCount: updatedKeywords?.length || 0,
    });

  } catch (error: any) {
    console.error('Bulk update keywords error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}