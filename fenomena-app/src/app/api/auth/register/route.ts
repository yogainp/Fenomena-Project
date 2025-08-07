import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  regionId: z.string().min(1, 'Region is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = registerSchema.parse(body);

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .or(`email.eq.${validatedData.email},username.eq.${validatedData.username}`)
      .limit(1);

    if (existingUser && existingUser.length > 0) {
      return NextResponse.json(
        { error: 'User with this email or username already exists' },
        { status: 400 }
      );
    }

    // Verify region exists
    if (validatedData.regionId) {
      const { data: region, error } = await supabase
        .from('regions')
        .select('id')
        .eq('id', validatedData.regionId)
        .single();
      
      if (error || !region) {
        return NextResponse.json(
          { error: 'Invalid region selected' },
          { status: 400 }
        );
      }
    }

    const user = await createUser({
      email: validatedData.email,
      username: validatedData.username,
      password: validatedData.password,
      role: 'USER', // Always set to USER for new registrations
      regionId: validatedData.regionId,
      isVerified: false, // New registrations are always unverified
    });

    return NextResponse.json(
      { message: 'User created successfully', user },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}