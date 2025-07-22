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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = requireAuth(request);

    const phenomenon = await prisma.phenomenon.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            username: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        period: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!phenomenon) {
      return NextResponse.json({ error: 'Phenomenon not found' }, { status: 404 });
    }

    return NextResponse.json(phenomenon);
  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Get phenomenon error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = requireAuth(request);

    const body = await request.json();
    const validatedData = phenomenonSchema.parse(body);

    const existingPhenomenon = await prisma.phenomenon.findUnique({
      where: { id: params.id },
    });

    if (!existingPhenomenon) {
      return NextResponse.json({ error: 'Phenomenon not found' }, { status: 404 });
    }

    // Check if user owns this phenomenon or is admin
    if (existingPhenomenon.userId !== user.userId && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
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

    const phenomenon = await prisma.phenomenon.update({
      where: { id: params.id },
      data: validatedData,
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

    return NextResponse.json(phenomenon);
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
    console.error('Update phenomenon error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = requireAuth(request);

    const existingPhenomenon = await prisma.phenomenon.findUnique({
      where: { id: params.id },
    });

    if (!existingPhenomenon) {
      return NextResponse.json({ error: 'Phenomenon not found' }, { status: 404 });
    }

    // Check if user owns this phenomenon or is admin
    if (existingPhenomenon.userId !== user.userId && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await prisma.phenomenon.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Phenomenon deleted successfully' });
  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Delete phenomenon error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}