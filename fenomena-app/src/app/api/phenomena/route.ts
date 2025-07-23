import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';

const phenomenonSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  categoryId: z.string().min(1, 'Category is required'),
  periodId: z.string().min(1, 'Period is required'),
  regionId: z.string().min(1, 'Region is required'),
});

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    const url = new URL(request.url);
    const categoryId = url.searchParams.get('categoryId');
    const periodId = url.searchParams.get('periodId');
    const regionId = url.searchParams.get('regionId');
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

    // Filter by region if provided
    if (regionId) {
      whereClause.regionId = regionId;
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
        region: {
          select: {
            province: true,
            city: true,
            regionCode: true,
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

    // Get current user's region
    const currentUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { regionId: true, role: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Enforce region restriction for non-admin users
    if (currentUser.role !== 'ADMIN') {
      if (!currentUser.regionId) {
        return NextResponse.json({ 
          error: 'You must be assigned to a region to create phenomena. Please contact admin.' 
        }, { status: 403 });
      }

      if (validatedData.regionId !== currentUser.regionId) {
        return NextResponse.json({ 
          error: 'You can only create phenomena in your assigned region.' 
        }, { status: 403 });
      }
    }

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

    // Verify region exists
    const region = await prisma.region.findUnique({
      where: { id: validatedData.regionId },
    });
    if (!region) {
      return NextResponse.json({ error: 'Region not found' }, { status: 404 });
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
        region: {
          select: {
            province: true,
            city: true,
            regionCode: true,
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