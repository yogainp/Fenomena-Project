import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log(`[MIDDLEWARE] Processing: ${pathname}`);

  // Skip middleware for public paths
  const publicPaths = ['/login', '/register', '/api/auth/login', '/api/auth/register'];
  if (publicPaths.some(path => pathname.startsWith(path))) {
    console.log(`[MIDDLEWARE] Skipping public path: ${pathname}`);
    return NextResponse.next();
  }

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.includes('.')
  ) {
    console.log(`[MIDDLEWARE] Skipping static/internal: ${pathname}`);
    return NextResponse.next();
  }

  const token = request.cookies.get('auth-token')?.value;
  console.log(`[MIDDLEWARE] Token found: ${!!token}`);
  
  if (token) {
    console.log(`[MIDDLEWARE] Token length: ${token.length}`);
  }

  if (!token) {
    console.log(`[MIDDLEWARE] No token, redirecting to login from: ${pathname}`);
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const user = verifyToken(token);
  console.log(`[MIDDLEWARE] Token verification result: ${!!user}`);
  
  if (!user) {
    console.log(`[MIDDLEWARE] Invalid token, redirecting to login from: ${pathname}`);
    return NextResponse.redirect(new URL('/login', request.url));
  }

  console.log(`[MIDDLEWARE] Auth successful for user: ${user.email} (${user.role})`);

  // Add user info to request headers for API routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', user.userId);
  requestHeaders.set('x-user-email', user.email);
  requestHeaders.set('x-user-role', user.role);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};