import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { requireRole } from '@/lib/middleware';

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  periodeSurvei: z.string().optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireRole(request, 'ADMIN');

    // Get category
    const { data: category, error: categoryError } = await supabase
      .from('survey_categories')
      .select('*')
      .eq('id', params.id)
      .single();

    if (categoryError) {
      if (categoryError.code === 'PGRST116') { // No rows found
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }
      console.error('Error fetching category:', categoryError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Get phenomena count for this category
    const { count: phenomenaCount, error: countError } = await supabase
      .from('phenomena')
      .select('*', { count: 'exact', head: true })
      .eq('categoryId', params.id);

    if (countError) {
      console.error('Error counting phenomena:', countError);
    }

    const categoryWithCount = {
      ...category,
      _count: {
        phenomena: phenomenaCount || 0,
      },
    };

    return NextResponse.json(categoryWithCount);
  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Get category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireRole(request, 'ADMIN');

    const body = await request.json();
    const validatedData = categorySchema.parse(body);

    // Check if category exists
    const { data: existingCategory, error: existsError } = await supabase
      .from('survey_categories')
      .select('id')
      .eq('id', params.id)
      .single();

    if (existsError) {
      if (existsError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }
      console.error('Error checking category exists:', existsError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Check for duplicate name
    const { data: duplicateCategory, error: duplicateError } = await supabase
      .from('survey_categories')
      .select('id')
      .eq('name', validatedData.name)
      .neq('id', params.id)
      .single();

    if (duplicateError && duplicateError.code !== 'PGRST116') {
      console.error('Error checking duplicate category:', duplicateError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (duplicateCategory) {
      return NextResponse.json(
        { error: 'Category with this name already exists' },
        { status: 400 }
      );
    }

    // Update category
    const { data: category, error: updateError } = await supabase
      .from('survey_categories')
      .update({
        name: validatedData.name,
        description: validatedData.description || null,
        periodeSurvei: validatedData.periodeSurvei || null,
        startDate: validatedData.startDate || null,
        endDate: validatedData.endDate || null,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating category:', updateError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json(category);
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
    console.error('Update category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireRole(request, 'ADMIN');

    // Check if category exists
    const { data: existingCategory, error: existsError } = await supabase
      .from('survey_categories')
      .select('id')
      .eq('id', params.id)
      .single();

    if (existsError) {
      if (existsError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }
      console.error('Error checking category exists:', existsError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Check if category has phenomena
    const { count: phenomenaCount, error: countError } = await supabase
      .from('phenomena')
      .select('*', { count: 'exact', head: true })
      .eq('categoryId', params.id);

    if (countError) {
      console.error('Error counting phenomena:', countError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (phenomenaCount && phenomenaCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category that has phenomena' },
        { status: 400 }
      );
    }

    // Delete category
    const { error: deleteError } = await supabase
      .from('survey_categories')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      console.error('Error deleting category:', deleteError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Delete category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}