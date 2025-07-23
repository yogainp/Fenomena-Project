import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/middleware';
import { hashPassword } from '@/lib/auth';
import { z } from 'zod';

const updateUserSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  username: z.string().min(3, 'Username must be at least 3 characters').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  role: z.enum(['ADMIN', 'USER']).optional(),
});

// GET /api/admin/users/[id] - Get specific user
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireRole(request, 'ADMIN');

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            phenomena: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...user,
      phenomenaCount: user._count.phenomena,
      _count: undefined,
    });

  } catch (error: any) {
    console.error('Get user error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/users/[id] - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireRole(request, 'ADMIN');

    const body = await request.json();
    const validationResult = updateUserSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      }, { status: 400 });
    }

    const updateData = validationResult.data;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check for email/username conflicts if they're being updated
    if (updateData.email || updateData.username) {
      const conflictConditions: any[] = [];
      
      if (updateData.email && updateData.email !== existingUser.email) {
        conflictConditions.push({ email: updateData.email });
      }
      
      if (updateData.username && updateData.username !== existingUser.username) {
        conflictConditions.push({ username: updateData.username });
      }

      if (conflictConditions.length > 0) {
        const conflictUser = await prisma.user.findFirst({
          where: {
            AND: [
              { id: { not: params.id } },
              { OR: conflictConditions },
            ],
          },
        });

        if (conflictUser) {
          const conflictField = conflictUser.email === updateData.email ? 'Email' : 'Username';
          return NextResponse.json({
            error: `${conflictField} already exists`,
          }, { status: 409 });
        }
      }
    }

    // Prepare update data
    const dataToUpdate: any = {};
    
    if (updateData.email) dataToUpdate.email = updateData.email;
    if (updateData.username) dataToUpdate.username = updateData.username;
    if (updateData.role) dataToUpdate.role = updateData.role;
    
    if (updateData.password) {
      dataToUpdate.password = await hashPassword(updateData.password);
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            phenomena: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: 'User updated successfully',
      user: {
        ...updatedUser,
        phenomenaCount: updatedUser._count.phenomena,
        _count: undefined,
      },
    });

  } catch (error: any) {
    console.error('Update user error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id] - Delete user
export async function DELETE(
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
        _count: {
          select: {
            phenomena: true,
          },
        },
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has phenomena (optional: you might want to prevent deletion)
    if (existingUser._count.phenomena > 0) {
      return NextResponse.json({
        error: `Cannot delete user. User has ${existingUser._count.phenomena} phenomena. Please reassign or delete phenomena first.`,
      }, { status: 400 });
    }

    // Delete user
    await prisma.user.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      message: 'User deleted successfully',
      deletedUser: {
        id: existingUser.id,
        username: existingUser.username,
      },
    });

  } catch (error: any) {
    console.error('Delete user error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}