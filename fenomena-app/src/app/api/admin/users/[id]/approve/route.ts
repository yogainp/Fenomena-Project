import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/middleware';

// PATCH /api/admin/users/[id]/approve - Approve user
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireRole(request, 'ADMIN');

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        username: true,
        email: true,
        isVerified: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (existingUser.isVerified) {
      return NextResponse.json({ error: 'User is already verified' }, { status: 400 });
    }

    // Approve user
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        username: true,
        isVerified: true,
        verifiedAt: true,
      },
    });

    return NextResponse.json({
      message: 'User approved successfully',
      user: updatedUser,
    });

  } catch (error: any) {
    console.error('Approve user error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}