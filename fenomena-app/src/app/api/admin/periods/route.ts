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

export async function GET(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    const { data: categories, error } = await supabase
      .from('survey_categories')
      .select('*')
      .order('startDate', { ascending: false });

    if (error) {
      console.error('Error fetching periods:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ periods: categories });
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

    const { data: existingCategory, error: checkError } = await supabase
      .from('survey_categories')
      .select('id')
      .eq('name', validatedData.name)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing category:', checkError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (existingCategory) {
      return NextResponse.json(
        { error: 'Category with this name already exists' },
        { status: 400 }
      );
    }

    const { data: period, error: createError } = await supabase
      .from('survey_categories')
      .insert({
        id: crypto.randomUUID(),
        name: validatedData.name,
        startDate: validatedData.startDate,
        endDate: validatedData.endDate,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating period:', createError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json(period, { status: 201 });
  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Create period error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}