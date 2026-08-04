import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('hazel_session');

  // Allow static assets, next internal files, and API routes
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
    if (pathname === '/admin/login') {
      return NextResponse.redirect(new URL('/login?portal=admin', request.url));
    }
    // If they are NOT on /login, redirect immediately to /login
    if (pathname !== '/login') {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 2. If user IS logged in:
  try {
    const session = JSON.parse(sessionCookie.value);

    // If super admin:
    if (session.role === 'admin') {
      // If super admin visits /login or /admin/login, send to /admin
      if (pathname === '/login' || pathname === '/admin/login') {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      // Super admin can freely access BOTH / (Client Panel) and /admin (Admin Dashboard)!
      return NextResponse.next();
    } 

    // If client user:
    if (session.role === 'client') {
      // Client cannot access /admin or /admin/login -> redirect to /
      if (pathname.startsWith('/admin')) {
        return NextResponse.redirect(new URL('/', request.url));
      }
      // If client visits /login or /client, send to / (Full Client Workspace)
      if (pathname === '/login' || pathname === '/client') {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
  } catch (e) {
    // Invalid cookie fallback -> redirect to /login
    const loginUrl = new URL('/login', request.url);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete('hazel_session');
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

