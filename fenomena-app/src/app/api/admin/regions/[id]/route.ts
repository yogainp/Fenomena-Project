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

    const region = await prisma.region.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            users: true,
            phenomena: true,
          },
        },
        users: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
          take: 10, // Limit to first 10 users for preview
        },
        phenomena: {
          select: {
            id: true,
            title: true,
            createdAt: true,
            user: {
              select: {
                username: true,
              },
            },
          },
          take: 10, // Limit to first 10 phenomena for preview
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!region) {
      return NextResponse.json({ error: 'Region not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...region,
      userCount: region._count.users,
      phenomenaCount: region._count.phenomena,
      _count: undefined,
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
    const existingRegion = await prisma.region.findUnique({
      where: { id: params.id },
    });

    if (!existingRegion) {
      return NextResponse.json({ error: 'Region not found' }, { status: 404 });
    }

    // Check for region code conflict if it's being updated
    if (updateData.regionCode && updateData.regionCode !== existingRegion.regionCode) {
      const conflictRegion = await prisma.region.findFirst({
        where: {
          AND: [
            { id: { not: params.id } },
            { regionCode: updateData.regionCode },
          ],
        },
      });

      if (conflictRegion) {
        return NextResponse.json({
          error: 'Region code already exists',
        }, { status: 409 });
      }
    }

    // Update region
    const updatedRegion = await prisma.region.update({
      where: { id: params.id },
      data: updateData,
      include: {
        _count: {
          select: {
            users: true,
            phenomena: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: 'Region updated successfully',
      region: {
        ...updatedRegion,
        userCount: updatedRegion._count.users,
        phenomenaCount: updatedRegion._count.phenomena,
        _count: undefined,
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
    const existingRegion = await prisma.region.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            users: true,
            phenomena: true,
          },
        },
      },
    });

    if (!existingRegion) {
      return NextResponse.json({ error: 'Region not found' }, { status: 404 });
    }

    // Check if region has associated users or phenomena
    if (existingRegion._count.users > 0 || existingRegion._count.phenomena > 0) {
      return NextResponse.json({
        error: `Cannot delete region. Region has ${existingRegion._count.users} users and ${existingRegion._count.phenomena} phenomena. Please reassign or delete them first.`,
      }, { status: 400 });
    }

    // Delete region
    await prisma.region.delete({
      where: { id: params.id },
    });

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