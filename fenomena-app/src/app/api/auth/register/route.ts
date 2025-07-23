import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  regionId: z.string().min(1, 'Region is required'),
  role: z.enum(['ADMIN', 'USER']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = registerSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: validatedData.email },
          { username: validatedData.username },
        ],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email or username already exists' },
        { status: 400 }
      );
    }

    // Verify region exists
    if (validatedData.regionId) {
      const region = await prisma.region.findUnique({
        where: { id: validatedData.regionId },
      });
      
      if (!region) {
        return NextResponse.json(
          { error: 'Invalid region selected' },
          { status: 400 }
        );
      }
    }

    const user = await createUser(
      validatedData.email,
      validatedData.username,
      validatedData.password,
      validatedData.role,
      validatedData.regionId
    );

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