import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireRole } from '@/lib/middleware';
import { hashPassword } from '@/lib/auth';
import { z } from 'zod';

const updateUserSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  username: z.string().min(3, 'Username must be at least 3 characters').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  role: z.enum(['ADMIN', 'USER']).optional(),
  regionId: z.string().nullable().optional(),
  isVerified: z.boolean().optional(),
});

// GET /api/admin/users/[id] - Get specific user
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireRole(request, 'ADMIN');

    // Get user with region data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        username,
        role,
        regionId,
        isVerified,
        verifiedAt,
        createdAt,
        updatedAt,
        regions:regionId (
          id,
          province,
          city,
          regionCode
        )
      `)
      .eq('id', params.id)
      .single();

    if (userError) {
      if (userError.code === 'PGRST116') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      console.error('Error fetching user:', userError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Get phenomena count for this user
    const { count: phenomenaCount, error: countError } = await supabase
      .from('phenomena')
      .select('*', { count: 'exact', head: true })
      .eq('userId', params.id);

    if (countError) {
      console.error('Error counting phenomena:', countError);
    }

    return NextResponse.json({
      ...user,
      region: user.regions,
      regions: undefined, // Remove the nested object
      phenomenaCount: phenomenaCount || 0,
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
    const { data: existingUser, error: existsError } = await supabase
      .from('users')
      .select('id, email, username, isVerified')
      .eq('id', params.id)
      .single();

    if (existsError) {
      if (existsError.code === 'PGRST116') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      console.error('Error checking user exists:', existsError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Check for email/username conflicts if they're being updated
    if (updateData.email || updateData.username) {
      const conflicts = [];
      
      if (updateData.email && updateData.email !== existingUser.email) {
        const { data: emailConflict } = await supabase
          .from('users')
          .select('id')
          .eq('email', updateData.email)
          .neq('id', params.id)
          .single();
        
        if (emailConflict) {
          conflicts.push('Email already exists');
        }
      }
      
      if (updateData.username && updateData.username !== existingUser.username) {
        const { data: usernameConflict } = await supabase
          .from('users')
          .select('id')
          .eq('username', updateData.username)
          .neq('id', params.id)
          .single();
        
        if (usernameConflict) {
          conflicts.push('Username already exists');
        }
      }

      if (conflicts.length > 0) {
        return NextResponse.json({
          error: conflicts[0],
        }, { status: 409 });
      }
    }

    // Prepare update data
    const dataToUpdate: any = {};
    
    if (updateData.email) dataToUpdate.email = updateData.email;
    if (updateData.username) dataToUpdate.username = updateData.username;
    if (updateData.role) dataToUpdate.role = updateData.role;
    if (updateData.regionId !== undefined) dataToUpdate.regionId = updateData.regionId;
    if (updateData.isVerified !== undefined) {
      dataToUpdate.isVerified = updateData.isVerified;
      if (updateData.isVerified && !existingUser.isVerified) {
        dataToUpdate.verifiedAt = new Date();
      } else if (!updateData.isVerified) {
        dataToUpdate.verifiedAt = null;
      }
    }
    
    if (updateData.password) {
      dataToUpdate.password = await hashPassword(updateData.password);
    }

    // Add updatedAt timestamp
    dataToUpdate.updatedAt = new Date().toISOString();

    // Update user
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(dataToUpdate)
      .eq('id', params.id)
      .select(`
        id,
        email,
        username,
        role,
        regionId,
        isVerified,
        verifiedAt,
        createdAt,
        updatedAt,
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

    // Get phenomena count for this user
    const { count: phenomenaCount, error: countError } = await supabase
      .from('phenomena')
      .select('*', { count: 'exact', head: true })
      .eq('userId', params.id);

    if (countError) {
      console.error('Error counting phenomena:', countError);
    }

    return NextResponse.json({
      message: 'User updated successfully',
      user: {
        ...updatedUser,
        region: updatedUser.regions,
        regions: undefined, // Remove the nested object
        phenomenaCount: phenomenaCount || 0,
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
    const { data: existingUser, error: existsError } = await supabase
      .from('users')
      .select('id, username')
      .eq('id', params.id)
      .single();

    if (existsError) {
      if (existsError.code === 'PGRST116') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      console.error('Error checking user exists:', existsError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Check if user has phenomena (optional: you might want to prevent deletion)
    const { count: phenomenaCount, error: countError } = await supabase
      .from('phenomena')
      .select('*', { count: 'exact', head: true })
      .eq('userId', params.id);

    if (countError) {
      console.error('Error counting phenomena:', countError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (phenomenaCount && phenomenaCount > 0) {
      return NextResponse.json({
        error: `Cannot delete user. User has ${phenomenaCount} phenomena. Please reassign or delete phenomena first.`,
      }, { status: 400 });
    }

    // Delete user
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

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