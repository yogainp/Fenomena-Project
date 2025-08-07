import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireRole(request, 'ADMIN');

    const body = await request.json();
    const validatedData = periodSchema.parse(body);

    const existingPeriod = await prisma.surveyPeriod.findUnique({
      where: { id: params.id },
    });

    if (!existingPeriod) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    const duplicatePeriod = await prisma.surveyPeriod.findFirst({
      where: {
        name: validatedData.name,
        NOT: { id: params.id },
      },
    });

    if (duplicatePeriod) {
      return NextResponse.json(
        { error: 'Period with this name already exists' },
        { status: 400 }
      );
    }

    const period = await prisma.surveyPeriod.update({
      where: { id: params.id },
      data: {
        name: validatedData.name,
        startDate: new Date(validatedData.startDate),
        endDate: new Date(validatedData.endDate),
      },
    });

    return NextResponse.json(period);
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
    console.error('Update period error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireRole(request, 'ADMIN');

    const existingPeriod = await prisma.surveyPeriod.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            phenomena: true,
          },
        },
      },
    });

    if (!existingPeriod) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    if (existingPeriod._count.phenomena > 0) {
      return NextResponse.json(
        { error: 'Cannot delete period that has phenomena' },
        { status: 400 }
      );
    }

    await prisma.surveyPeriod.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Period deleted successfully' });
  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Delete period error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}