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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireRole(request, 'ADMIN');
    const { id } = await params;

    const body = await request.json();
    const validatedData = periodSchema.parse(body);

    const { data: existingPeriod, error: fetchError } = await supabase
      .from('survey_categories')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching period:', fetchError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!existingPeriod) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    const { data: duplicatePeriod, error: duplicateError } = await supabase
      .from('survey_categories')
      .select('id')
      .eq('name', validatedData.name)
      .neq('id', id)
      .single();

    if (duplicateError && duplicateError.code !== 'PGRST116') {
      console.error('Error checking duplicate period:', duplicateError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (duplicatePeriod) {
      return NextResponse.json(
        { error: 'Period with this name already exists' },
        { status: 400 }
      );
    }

    const { data: period, error: updateError } = await supabase
      .from('survey_categories')
      .update({
        name: validatedData.name,
        startDate: validatedData.startDate,
        endDate: validatedData.endDate,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating period:', updateError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json(period);
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
    console.error('Update period error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireRole(request, 'ADMIN');
    const { id } = await params;

    const { data: existingPeriod, error: fetchError } = await supabase
      .from('survey_categories')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching period:', fetchError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Check for related phenomena
    const { count: phenomenaCount, error: countError } = await supabase
      .from('phenomena')
      .select('*', { count: 'exact', head: true })
      .eq('categoryId', id);

    if (countError) {
      console.error('Error counting phenomena:', countError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!existingPeriod) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    if ((phenomenaCount || 0) > 0) {
      return NextResponse.json(
        { error: 'Cannot delete period that has phenomena' },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from('survey_categories')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting period:', deleteError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Period deleted successfully' });
  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Delete period error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}