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

export async function GET(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    // Get categories
    const { data: categories, error: categoriesError } = await supabase
      .from('survey_categories')
      .select('*')
      .order('createdAt', { ascending: false });

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Get phenomena counts for each category
    const categoriesWithCounts = await Promise.all(
      (categories || []).map(async (category) => {
        const { count: phenomenaCount, error: countError } = await supabase
          .from('phenomena')
          .select('*', { count: 'exact', head: true })
          .eq('categoryId', category.id);

        if (countError) {
          console.error('Error counting phenomena for category:', category.id, countError);
        }

        return {
          ...category,
          _count: {
            phenomena: phenomenaCount || 0,
          },
        };
      })
    );

    return NextResponse.json(categoriesWithCounts);
  } catch (error: any) {
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Get categories error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    const body = await request.json();
    const validatedData = categorySchema.parse(body);

    // Check if category with same name exists
    const { data: existingCategory, error: checkError } = await supabase
      .from('survey_categories')
      .select('id')
      .eq('name', validatedData.name)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error checking existing category:', checkError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (existingCategory) {
      return NextResponse.json(
        { error: 'Category with this name already exists' },
        { status: 400 }
      );
    }

    // Create new category
    const { data: category, error: createError } = await supabase
      .from('survey_categories')
      .insert({
        name: validatedData.name,
        description: validatedData.description || null,
        periodeSurvei: validatedData.periodeSurvei || null,
        startDate: validatedData.startDate || null,
        endDate: validatedData.endDate || null,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating category:', createError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json(category, { status: 201 });
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
    console.error('Create category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}