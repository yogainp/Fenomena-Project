import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken, hashPassword } from '@/lib/auth';
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
    // Get auth token from cookie
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify token
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get user data from Supabase
    const { data: userProfile, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        username,
        role,
        regionId,
        isVerified,
        createdAt,
        updatedAt,
        region:regions(
          id,
          province,
          city,
          regionCode
        )
      `)
      .eq('id', user.userId)
      .single();

    if (error || !userProfile) {
      console.error('Profile fetch error:', error);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(userProfile);

  } catch (error: any) {
    console.error('Get profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/profile - Update current user profile
export async function PUT(request: NextRequest) {
  try {
    // Get auth token from cookie
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify token
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = updateProfileSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validationResult.error.issues,
      }, { status: 400 });
    }

    const { email, username, regionId, currentPassword, newPassword } = validationResult.data;

    // Get current user data
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.userId)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

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
        // Check for conflicts in Supabase
        let conflictUser = null;
        if (email && email !== currentUser.email) {
          const { data } = await supabase
            .from('users')
            .select('id, email')
            .eq('email', email)
            .neq('id', user.userId)
            .single();
          if (data) conflictUser = data;
        }
        if (!conflictUser && username && username !== currentUser.username) {
          const { data } = await supabase
            .from('users')
            .select('id, username')
            .eq('username', username)
            .neq('id', user.userId)
            .single();
          if (data) conflictUser = data;
        }

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
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        ...dataToUpdate,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', user.userId)
      .select(`
        id,
        email,
        username,
        role,
        createdAt,
        updatedAt,
        regionId,
        regions:regionId (
          id,
          province,
          city,
          regionCode
        )
      `)
      .single();

    if (updateError) {
      console.error('Error updating user:', updateError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Get phenomena count
    const { count: phenomenaCount } = await supabase
      .from('phenomena')
      .select('*', { count: 'exact', head: true })
      .eq('userId', user.userId);

    const response = {
      message: 'Profile updated successfully',
      user: {
        ...updatedUser,
        region: updatedUser.regions,
        _count: {
          phenomena: phenomenaCount || 0,
        },
      },
    };

    const responseMessage = newPassword ? 
      'Profile and password updated successfully' : 
      'Profile updated successfully';

    return NextResponse.json({
      ...response,
      message: responseMessage,
    });

  } catch (error: any) {
    console.error('Update profile error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}