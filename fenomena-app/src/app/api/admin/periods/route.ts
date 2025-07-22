import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/middleware';

const periodSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  startDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid start date format',
  }),
  endDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid end date format',
  }),
}).refine((data) => new Date(data.startDate) < new Date(data.endDate), {
  message: 'End date must be after start date',
});

export async function GET(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    const periods = await prisma.surveyPeriod.findMany({
      orderBy: {
        startDate: 'desc',
      },
      include: {
        _count: {
          select: {
            phenomena: true,
          },
        },
      },
    });

    return NextResponse.json(periods);
  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Get periods error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    const body = await request.json();
    const validatedData = periodSchema.parse(body);

    const existingPeriod = await prisma.surveyPeriod.findUnique({
      where: { name: validatedData.name },
    });

    if (existingPeriod) {
      return NextResponse.json(
        { error: 'Period with this name already exists' },
        { status: 400 }
      );
    }

    const period = await prisma.surveyPeriod.create({
      data: {
        name: validatedData.name,
        startDate: new Date(validatedData.startDate),
        endDate: new Date(validatedData.endDate),
      },
    });

    return NextResponse.json(period, { status: 201 });
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
    console.error('Create period error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}