import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireRole } from '@/lib/middleware';
import { z } from 'zod';

const regionSchema = z.object({
  province: z.string().min(1, 'Province is required'),
  city: z.string().min(1, 'City is required'),
  regionCode: z.string().min(1, 'Region code is required'),
});

// GET /api/admin/regions - List all regions
export async function GET(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const province = searchParams.get('province') || '';

    const skip = (page - 1) * limit;

    // Build Supabase query
    let query = supabase.from('regions').select('*', { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.or(`city.ilike.%${search}%,province.ilike.%${search}%,regionCode.ilike.%${search}%`);
    }

    if (province) {
      query = query.ilike('province', `%${province}%`);
    }

    // Apply pagination and ordering
    const offset = (page - 1) * limit;
    query = query
      .order('province', { ascending: true })
      .order('city', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data: regionsData, count: totalRegions, error: regionsError } = await query;

    if (regionsError) {
      console.error('Error fetching regions:', regionsError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Get user and phenomena counts for each region
    const regionsWithCounts = await Promise.all(
      (regionsData || []).map(async (region: any) => {
        const [
          { count: userCount, error: userCountError },
          { count: phenomenaCount, error: phenomenaCountError }
        ] = await Promise.all([
          supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('regionId', region.id),
          supabase
            .from('phenomena')
            .select('*', { count: 'exact', head: true })
            .eq('regionId', region.id)
        ]);

        if (userCountError) {
          console.error('Error counting users for region:', region.id, userCountError);
        }
        if (phenomenaCountError) {
          console.error('Error counting phenomena for region:', region.id, phenomenaCountError);
        }

        return {
          ...region,
          userCount: userCount || 0,
          phenomenaCount: phenomenaCount || 0,
        };
      })
    );

    const totalPages = Math.ceil((totalRegions || 0) / limit);

    return NextResponse.json({
      regions: regionsWithCounts,
      pagination: {
        currentPage: page,
        totalPages,
        totalRegions: totalRegions || 0,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });

  } catch (error: any) {
    console.error('Get regions error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/regions - Create new region
export async function POST(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    const body = await request.json();
    const validationResult = regionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      }, { status: 400 });
    }

    const { province, city, regionCode } = validationResult.data;

    // Check if region code already exists
    const { data: existingRegion, error: checkError } = await supabase
      .from('regions')
      .select('id')
      .eq('regionCode', regionCode)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error checking existing region:', checkError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (existingRegion) {
      return NextResponse.json({
        error: 'Region with this code already exists',
      }, { status: 409 });
    }

    // Create region
    const { data: newRegion, error: createError } = await supabase
      .from('regions')
      .insert({
        id: crypto.randomUUID(),
        province,
        city,
        regionCode,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating region:', createError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Region created successfully',
      region: {
        ...newRegion,
        userCount: 0,
        phenomenaCount: 0,
      },
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create region error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}