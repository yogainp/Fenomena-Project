import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireRole } from '@/lib/middleware';
import { createUser } from '@/lib/auth';
import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'USER']).optional().default('USER'),
  regionId: z.string().optional(),
  isVerified: z.boolean().optional().default(false),
});

// GET /api/admin/users - List all users
export async function GET(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const roleFilter = searchParams.get('role') || '';
    const verificationFilter = searchParams.get('verification') || '';

    const skip = (page - 1) * limit;

    // Build Supabase query
    let query = supabase
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
      `, { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.or(`email.ilike.%${search}%,username.ilike.%${search}%`);
    }

    if (roleFilter && (roleFilter === 'ADMIN' || roleFilter === 'USER')) {
      query = query.eq('role', roleFilter);
    }

    if (verificationFilter) {
      query = query.eq('isVerified', verificationFilter === 'verified');
    }

    // Apply pagination and ordering
    const offset = (page - 1) * limit;
    query = query
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: usersData, count: totalUsers, error: usersError } = await query;

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Get phenomena count for each user manually
    const usersWithCounts = await Promise.all(
      (usersData || []).map(async (user: any) => {
        const { count: phenomenaCount, error: countError } = await supabase
          .from('phenomena')
          .select('*', { count: 'exact', head: true })
          .eq('userId', user.id);

        if (countError) {
          console.error('Error counting phenomena for user:', user.id, countError);
        }

        return {
          ...user,
          region: user.regions,
          regions: undefined, // Remove the nested object
          phenomenaCount: phenomenaCount || 0,
        };
      })
    );

    const totalPages = Math.ceil((totalUsers || 0) / limit);

    return NextResponse.json({
      users: usersWithCounts,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers: totalUsers || 0,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });

  } catch (error: any) {
    console.error('Get users error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/users - Create new user
export async function POST(request: NextRequest) {
  try {
    requireRole(request, 'ADMIN');

    const body = await request.json();
    const validationResult = createUserSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validationResult.error.issues,
      }, { status: 400 });
    }

    const { email, username, password, role, regionId, isVerified } = validationResult.data;

    // Check if email or username already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, email, username')
      .or(`email.eq.${email},username.eq.${username}`)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error checking existing user:', checkError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (existingUser) {
      return NextResponse.json({
        error: existingUser.email === email ? 'Email already exists' : 'Username already exists',
      }, { status: 409 });
    }

    // Create user
    const newUser = await createUser({
      email,
      username,
      password,
      role,
      regionId: regionId || undefined,
      isVerified,
    });

    // Return user without password (newUser from Supabase might not have password field)
    const userWithoutPassword = { ...(newUser as any) };
    if ('password' in userWithoutPassword) {
      delete userWithoutPassword.password;
    }

    return NextResponse.json({
      message: 'User created successfully',
      user: userWithoutPassword,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create user error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}