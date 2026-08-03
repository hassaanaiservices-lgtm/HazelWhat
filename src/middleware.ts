import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('hazel_session');

  // Allow static assets, next internal files, and login API
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // 1. If user is NOT logged in:
  if (!sessionCookie || !sessionCookie.value) {
    // If they are NOT on /login, redirect immediately to /login
    if (pathname !== '/login') {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 2. If user IS logged in and tries to access /login or root /:
  if (pathname === '/login' || pathname === '/') {
    try {
      const session = JSON.parse(sessionCookie.value);
      if (session.role === 'admin') {
        return NextResponse.redirect(new URL('/admin', request.url));
      } else {
        return NextResponse.redirect(new URL('/client', request.url));
      }
    } catch (e) {
      // Invalid cookie fallback -> redirect to /login
      const loginUrl = new URL('/login', request.url);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete('hazel_session');
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
