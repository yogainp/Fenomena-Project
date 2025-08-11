import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/middleware';

const phenomenonSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  categoryId: z.string().min(1, 'Category is required'),
  regionId: z.string().min(1, 'Region is required'),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id } = await params;

    const { data: phenomenon, error } = await supabase
      .from('phenomena')
      .select(`
        *,
        user:users(username),
        category:survey_categories(id, name, periodeSurvei, startDate, endDate),
        region:regions(id, province, city, regionCode)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id } = await params;

    const body = await request.json();
    const validatedData = phenomenonSchema.parse(body);

    const { data: existingPhenomenon, error: fetchError } = await supabase
      .from('phenomena')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Supabase error:', fetchError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!existingPhenomenon) {
      return NextResponse.json({ error: 'Phenomenon not found' }, { status: 404 });
    }

    // Check if user owns this phenomenon or is admin
    if (existingPhenomenon.userId !== user.userId && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // For non-admin users, check if phenomenon is in their region
    if (user.role !== 'ADMIN' && user.regionId !== existingPhenomenon.regionId) {
      return NextResponse.json({ error: 'Access denied - region mismatch' }, { status: 403 });
    }

    // Verify category exists
    const { data: category, error: categoryError } = await supabase
      .from('survey_categories')
      .select('*')
      .eq('id', validatedData.categoryId)
      .single();
    
    if (categoryError || !category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Verify region exists
    const { data: region, error: regionError } = await supabase
      .from('regions')
      .select('*')
      .eq('id', validatedData.regionId)
      .single();
    
    if (regionError || !region) {
      return NextResponse.json({ error: 'Region not found' }, { status: 404 });
    }

    // Update the phenomenon
    const { data: updatedPhenomenon, error: updateError } = await supabase
      .from('phenomena')
      .update({
        title: validatedData.title,
        description: validatedData.description,
        categoryId: validatedData.categoryId,
        regionId: validatedData.regionId,
      })
      .eq('id', id)
      .select(`
        *,
        category:survey_categories(name, periodeSurvei, startDate, endDate),
        region:regions(province, city, regionCode)
      `)
      .single();

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return NextResponse.json({ error: 'Failed to update phenomenon' }, { status: 500 });
    }

    const phenomenon = updatedPhenomenon;

    return NextResponse.json(phenomenon);
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
    console.error('Update phenomenon error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuth(request);
    const { id } = await params;

    const { data: existingPhenomenon, error: fetchError } = await supabase
      .from('phenomena')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingPhenomenon) {
      return NextResponse.json({ error: 'Phenomenon not found' }, { status: 404 });
    }

    // Check if user owns this phenomenon or is admin
    if (existingPhenomenon.userId !== user.userId && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // For non-admin users, check if phenomenon is in their region
    if (user.role !== 'ADMIN' && user.regionId !== existingPhenomenon.regionId) {
      return NextResponse.json({ error: 'Access denied - region mismatch' }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from('phenomena')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Supabase delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete phenomenon' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Phenomenon deleted successfully' });
  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Delete phenomenon error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}