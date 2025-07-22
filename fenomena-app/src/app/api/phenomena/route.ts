import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

const phenomenonSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  categoryId: z.string().min(1, 'Category is required'),
  periodId: z.string().min(1, 'Period is required'),
});

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const url = new URL(request.url);
    const categoryId = url.searchParams.get('categoryId');
    const periodId = url.searchParams.get('periodId');
    const search = url.searchParams.get('search');

    const whereClause: any = {};

    // Filter by category if provided
    if (categoryId) {
      whereClause.categoryId = categoryId;
    }

    // Filter by period if provided
    if (periodId) {
      whereClause.periodId = periodId;
    }

    // Search in title and description if provided
    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const phenomena = await prisma.phenomenon.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            username: true,
          },
        },
        category: {
          select: {
            name: true,
          },
        },
        period: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(phenomena);
  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Get phenomena error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const body = await request.json();
    const validatedData = phenomenonSchema.parse(body);

    // Verify category exists
    const category = await prisma.surveyCategory.findUnique({
      where: { id: validatedData.categoryId },
    });
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Verify period exists
    const period = await prisma.surveyPeriod.findUnique({
      where: { id: validatedData.periodId },
    });
    if (!period) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    const phenomenon = await prisma.phenomenon.create({
      data: {
        ...validatedData,
        userId: user.userId,
      },
      include: {
        category: {
          select: {
            name: true,
          },
        },
        period: {
          select: {
            name: true,
          },
        },
      },
    });

    return NextResponse.json(phenomenon, { status: 201 });
  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Create phenomenon error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}