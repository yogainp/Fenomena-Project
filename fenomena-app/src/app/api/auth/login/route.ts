import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateUser, generateToken } from '@/lib/auth';

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = loginSchema.parse(body);

    const user = await authenticateUser(validatedData.email, validatedData.password);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      regionId: user.regionId,
    });

    const response = NextResponse.json(
      { 
        message: 'Login successful', 
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          regionId: user.regionId,
          region: user.region,
        }
      },
      { status: 200 }
    );

    // Set HTTP-only cookie for security
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: false, // Set to false for development (localhost)
      sameSite: 'lax', // Changed from 'strict' to 'lax' for better browser compatibility
      maxAge: 86400, // 24 hours
      path: '/',
      domain: undefined, // Let browser set domain automatically
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    // Handle unverified user error
    if (error instanceof Error && error.message === 'UNVERIFIED_USER') {
      return NextResponse.json(
        { error: 'Akun Anda belum diverifikasi oleh admin. Silakan tunggu persetujuan admin.' },
        { status: 403 }
      );
    }

    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}