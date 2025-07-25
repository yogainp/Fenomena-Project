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
  console.log('=== Authentication Debug ===');
  console.log('Request URL:', request.url);
  console.log('Request method:', request.method);
  
  // Log all cookies
  const cookies = request.cookies.getAll();
  console.log('All cookies:', cookies.map(c => ({ name: c.name, value: c.value.substring(0, 50) + '...' })));
  
  // Log auth token cookie specifically
  const authToken = request.cookies.get('auth-token');
  console.log('Auth token cookie:', authToken ? { name: authToken.name, value: authToken.value.substring(0, 50) + '...' } : 'NOT FOUND');
  
  // Log headers
  console.log('Authorization header:', request.headers.get('authorization') || 'NOT FOUND');
  console.log('Content-Type header:', request.headers.get('content-type') || 'NOT FOUND');
  
  const user = authenticateRequest(request);
  console.log('Authentication result:', user ? { userId: user.userId, email: user.email, role: user.role } : 'FAILED');
  
  if (!user) {
    console.log('Authentication failed - throwing error');
    throw new Error('Authentication required');
  }
  
  console.log('Authentication successful');
  return user;
}

export function requireRole(request: NextRequest, role: 'ADMIN' | 'USER') {
  const user = requireAuth(request);
  
  if (user.role !== role) {
    throw new Error(`${role} role required`);
  }
  
  return user;
}