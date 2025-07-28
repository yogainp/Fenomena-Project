import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/middleware';
import { z } from 'zod';

const updateKeywordSchema = z.object({
  keyword: z.string().min(1, 'Keyword cannot be empty').max(100, 'Keyword too long').optional(),
  isActive: z.boolean().optional(),
  category: z.string().max(50, 'Category too long').optional(),
  description: z.string().max(255, 'Description too long').optional(),
});

// GET /api/admin/scrapping-keywords/[id] - Get single keyword
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireRole(request, 'ADMIN');

    const keyword = await prisma.scrappingKeyword.findUnique({
      where: { id: params.id },
    });

    if (!keyword) {
      return NextResponse.json({ error: 'Keyword not found' }, { status: 404 });
    }

    return NextResponse.json({ keyword });

  } catch (error: any) {
    console.error('Get keyword error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/scrapping-keywords/[id] - Update keyword
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireRole(request, 'ADMIN');

    const body = await request.json();
    const validationResult = updateKeywordSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      }, { status: 400 });
    }

    const updates = validationResult.data;

    // Check if keyword exists
    const existingKeyword = await prisma.scrappingKeyword.findUnique({
      where: { id: params.id },
    });

    if (!existingKeyword) {
      return NextResponse.json({ error: 'Keyword not found' }, { status: 404 });
    }

    // If updating keyword text, check for duplicates
    if (updates.keyword && updates.keyword !== existingKeyword.keyword) {
      const duplicateKeyword = await prisma.scrappingKeyword.findUnique({
        where: { keyword: updates.keyword.toLowerCase().trim() },
      });

      if (duplicateKeyword && duplicateKeyword.id !== params.id) {
        return NextResponse.json({
          error: 'Keyword already exists',
        }, { status: 409 });
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (updates.keyword !== undefined) {
      updateData.keyword = updates.keyword.toLowerCase().trim();
    }
    if (updates.isActive !== undefined) {
      updateData.isActive = updates.isActive;
    }
    if (updates.category !== undefined) {
      updateData.category = updates.category?.trim() || null;
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description?.trim() || null;
    }

    // Update keyword
    const updatedKeyword = await prisma.scrappingKeyword.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({
      message: 'Keyword updated successfully',
      keyword: updatedKeyword,
    });

  } catch (error: any) {
    console.error('Update keyword error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/scrapping-keywords/[id] - Delete keyword
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireRole(request, 'ADMIN');

    // Check if keyword exists
    const existingKeyword = await prisma.scrappingKeyword.findUnique({
      where: { id: params.id },
    });

    if (!existingKeyword) {
      return NextResponse.json({ error: 'Keyword not found' }, { status: 404 });
    }

    // Delete keyword
    await prisma.scrappingKeyword.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      message: 'Keyword deleted successfully',
    });

  } catch (error: any) {
    console.error('Delete keyword error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}