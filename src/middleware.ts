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
    // If attempting to access protected dashboards without a session
    if (pathname.startsWith('/client') || pathname.startsWith('/admin')) {
      const portal = pathname.startsWith('/admin') ? 'admin' : 'client';
      const loginUrl = new URL(`/login?portal=${portal}`, request.url);
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
      // Super admin can freely access BOTH / (Landing/Client Panel) and /admin (Admin Dashboard)!
      return NextResponse.next();
    } 

    // If client user:
    if (session.role === 'client') {
      // Client cannot access /admin or /admin/login -> redirect to /client
      if (pathname.startsWith('/admin')) {
        return NextResponse.redirect(new URL('/client', request.url));
      }
      // If client visits /login, send to /client
      if (pathname === '/login') {
        return NextResponse.redirect(new URL('/client', request.url));
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


