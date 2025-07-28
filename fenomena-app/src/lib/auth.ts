import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  regionId?: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export async function createUser(params: {
  email: string;
  username: string;
  password: string;
  role?: 'ADMIN' | 'USER';
  regionId?: string;
  isVerified?: boolean;
}) {
  const hashedPassword = await hashPassword(params.password);
  
  return prisma.user.create({
    data: {
      email: params.email,
      username: params.username,
      password: hashedPassword,
      role: params.role || 'USER',
      regionId: params.regionId || null,
      isVerified: params.isVerified || false,
      verifiedAt: params.isVerified ? new Date() : null,
    },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      regionId: true,
      region: {
        select: {
          id: true,
          province: true,
          city: true,
          regionCode: true,
        },
      },
      isVerified: true,
      verifiedAt: true,
      createdAt: true,
    },
  });
}

export async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      region: true,
    },
  });

  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    return null;
  }

  // Check if user is verified
  if (!user.isVerified) {
    throw new Error('UNVERIFIED_USER');
  }

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    regionId: user.regionId,
    region: user.region,
  };
}