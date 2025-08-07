import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireRole } from '@/lib/middleware';
import { z } from 'zod';

const updateRegionSchema = z.object({
  province: z.string().min(1, 'Province is required').optional(),
  city: z.string().min(1, 'City is required').optional(),
  regionCode: z.string().min(1, 'Region code is required').optional(),
});

// GET /api/admin/regions/[id] - Get specific region
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireRole(request, 'ADMIN');

    // Get region data
    const { data: region, error: regionError } = await supabase
      .from('regions')
      .select('*')
      .eq('id', params.id)
      .single();

    if (regionError) {
      if (regionError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Region not found' }, { status: 404 });
      }
      console.error('Error fetching region:', regionError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Get users count and sample users
    const [
      { count: userCount, error: userCountError },
      { data: sampleUsers, error: usersError }
    ] = await Promise.all([
      supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('regionId', params.id),
      supabase
        .from('users')
        .select('id, username, email, role')
        .eq('regionId', params.id)
        .limit(10)
    ]);

    // Get phenomena count and sample phenomena
    const [
      { count: phenomenaCount, error: phenomenaCountError },
      { data: samplePhenomena, error: phenomenaError }
    ] = await Promise.all([
      supabase
        .from('phenomena')
        .select('*', { count: 'exact', head: true })
        .eq('regionId', params.id),
      supabase
        .from('phenomena')
        .select(`
          id,
          title,
          createdAt,
          users:userId (
            username
          )
        `)
        .eq('regionId', params.id)
        .order('createdAt', { ascending: false })
        .limit(10)
    ]);

    if (userCountError) console.error('Error counting users:', userCountError);
    if (usersError) console.error('Error fetching sample users:', usersError);
    if (phenomenaCountError) console.error('Error counting phenomena:', phenomenaCountError);
    if (phenomenaError) console.error('Error fetching sample phenomena:', phenomenaError);

    // Format phenomena data to match expected structure
    const formattedPhenomena = (samplePhenomena || []).map((phenomenon: any) => ({
      ...phenomenon,
      user: phenomenon.users,
      users: undefined, // Remove the nested object
    }));

    return NextResponse.json({
      ...region,
      userCount: userCount || 0,
      phenomenaCount: phenomenaCount || 0,
      users: sampleUsers || [],
      phenomena: formattedPhenomena,
    });

  } catch (error: any) {
    console.error('Get region error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/regions/[id] - Update region
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireRole(request, 'ADMIN');

    const body = await request.json();
    const validationResult = updateRegionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      }, { status: 400 });
    }

    const updateData = validationResult.data;

    // Check if region exists
    const { data: existingRegion, error: existsError } = await supabase
      .from('regions')
      .select('id, regionCode')
      .eq('id', params.id)
      .single();

    if (existsError) {
      if (existsError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Region not found' }, { status: 404 });
      }
      console.error('Error checking region exists:', existsError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Check for region code conflict if it's being updated
    if (updateData.regionCode && updateData.regionCode !== existingRegion.regionCode) {
      const { data: conflictRegion, error: conflictError } = await supabase
        .from('regions')
        .select('id')
        .eq('regionCode', updateData.regionCode)
        .neq('id', params.id)
        .single();

      if (conflictError && conflictError.code !== 'PGRST116') {
        console.error('Error checking region code conflict:', conflictError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      if (conflictRegion) {
        return NextResponse.json({
          error: 'Region code already exists',
        }, { status: 409 });
      }
    }

    // Add updatedAt timestamp
    const dataToUpdate = {
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    // Update region
    const { data: updatedRegion, error: updateError } = await supabase
      .from('regions')
      .update(dataToUpdate)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating region:', updateError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Get counts for the updated region
    const [
      { count: userCount, error: userCountError },
      { count: phenomenaCount, error: phenomenaCountError }
    ] = await Promise.all([
      supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('regionId', params.id),
      supabase
        .from('phenomena')
        .select('*', { count: 'exact', head: true })
        .eq('regionId', params.id)
    ]);

    if (userCountError) console.error('Error counting users:', userCountError);
    if (phenomenaCountError) console.error('Error counting phenomena:', phenomenaCountError);

    return NextResponse.json({
      message: 'Region updated successfully',
      region: {
        ...updatedRegion,
        userCount: userCount || 0,
        phenomenaCount: phenomenaCount || 0,
      },
    });

  } catch (error: any) {
    console.error('Update region error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/regions/[id] - Delete region
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireRole(request, 'ADMIN');

    // Check if region exists
    const { data: existingRegion, error: existsError } = await supabase
      .from('regions')
      .select('id, city, province, regionCode')
      .eq('id', params.id)
      .single();

    if (existsError) {
      if (existsError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Region not found' }, { status: 404 });
      }
      console.error('Error checking region exists:', existsError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Check if region has associated users or phenomena
    const [
      { count: userCount, error: userCountError },
      { count: phenomenaCount, error: phenomenaCountError }
    ] = await Promise.all([
      supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('regionId', params.id),
      supabase
        .from('phenomena')
        .select('*', { count: 'exact', head: true })
        .eq('regionId', params.id)
    ]);

    if (userCountError || phenomenaCountError) {
      console.error('Error counting related records:', { userCountError, phenomenaCountError });
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if ((userCount || 0) > 0 || (phenomenaCount || 0) > 0) {
      return NextResponse.json({
        error: `Cannot delete region. Region has ${userCount || 0} users and ${phenomenaCount || 0} phenomena. Please reassign or delete them first.`,
      }, { status: 400 });
    }

    // Delete region
    const { error: deleteError } = await supabase
      .from('regions')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      console.error('Error deleting region:', deleteError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Region deleted successfully',
      deletedRegion: {
        id: existingRegion.id,
        city: existingRegion.city,
        province: existingRegion.province,
        regionCode: existingRegion.regionCode,
      },
    });

  } catch (error: any) {
    console.error('Delete region error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}