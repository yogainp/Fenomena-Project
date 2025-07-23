import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { hashPassword } from '@/lib/auth';
import { z } from 'zod';

const updateProfileSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  username: z.string().min(3, 'Username must be at least 3 characters').optional(),
  regionId: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, 'New password must be at least 6 characters').optional(),
}).refine(
  (data) => {
    // If newPassword is provided, currentPassword must also be provided
    if (data.newPassword && !data.currentPassword) {
      return false;
    }
    return true;
  },
  {
    message: 'Current password is required when setting a new password',
    path: ['currentPassword'],
  }
);

// GET /api/profile - Get current user profile
export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const userProfile = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        regionId: true,
        region: {
          select: {
            id: true,
            province: true,
            city: true,
            regionCode: true,
          },
        },
        _count: {
          select: {
            phenomena: true,
          },
        },
      },
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...userProfile,
      phenomenaCount: userProfile._count.phenomena,
      _count: undefined,
    });

  } catch (error: any) {
    console.error('Get profile error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/profile - Update current user profile
export async function PUT(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const body = await request.json();
    const validationResult = updateProfileSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      }, { status: 400 });
    }

    const { email, username, regionId, currentPassword, newPassword } = validationResult.data;

    // Get current user data
    const currentUser = await prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check for email/username conflicts if they're being updated
    if (email || username) {
      const conflictConditions: any[] = [];
      
      if (email && email !== currentUser.email) {
        conflictConditions.push({ email });
      }
      
      if (username && username !== currentUser.username) {
        conflictConditions.push({ username });
      }

      if (conflictConditions.length > 0) {
        const conflictUser = await prisma.user.findFirst({
          where: {
            AND: [
              { id: { not: user.userId } },
              { OR: conflictConditions },
            ],
          },
        });

        if (conflictUser) {
          const conflictField = conflictUser.email === email ? 'Email' : 'Username';
          return NextResponse.json({
            error: `${conflictField} already exists`,
          }, { status: 409 });
        }
      }
    }

    // Prepare update data
    const dataToUpdate: any = {};
    
    if (email) dataToUpdate.email = email;
    if (username) dataToUpdate.username = username;
    if (regionId !== undefined) dataToUpdate.regionId = regionId || null;

    // Handle password change
    if (newPassword && currentPassword) {
      const bcrypt = require('bcrypt');
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, currentUser.password);
      
      if (!isCurrentPasswordValid) {
        return NextResponse.json({
          error: 'Current password is incorrect',
        }, { status: 400 });
      }

      dataToUpdate.password = await hashPassword(newPassword);
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: user.userId },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        regionId: true,
        region: {
          select: {
            id: true,
            province: true,
            city: true,
            regionCode: true,
          },
        },
        _count: {
          select: {
            phenomena: true,
          },
        },
      },
    });

    const responseMessage = newPassword ? 
      'Profile and password updated successfully' : 
      'Profile updated successfully';

    return NextResponse.json({
      message: responseMessage,
      user: {
        ...updatedUser,
        phenomenaCount: updatedUser._count.phenomena,
        _count: undefined,
      },
    });

  } catch (error: any) {
    console.error('Update profile error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}