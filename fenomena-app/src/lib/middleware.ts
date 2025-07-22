import { NextRequest } from 'next/server';
import { verifyToken } from './auth';

export function getTokenFromRequest(request: NextRequest) {
  // Try to get token from cookie first
  const tokenFromCookie = request.cookies.get('auth-token')?.value;
  if (tokenFromCookie) {
    return tokenFromCookie;
  }

  // Fallback to Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

export function authenticateRequest(request: NextRequest) {
  const token = getTokenFromRequest(request);
  
  if (!token) {
    return null;
  }

  return verifyToken(token);
}

export function requireAuth(request: NextRequest) {
  const user = authenticateRequest(request);
  
  if (!user) {
    throw new Error('Authentication required');
  }
  
  return user;
}

export function requireRole(request: NextRequest, role: 'ADMIN' | 'USER') {
  const user = requireAuth(request);
  
  if (user.role !== role) {
    throw new Error(`${role} role required`);
  }
  
  return user;
}