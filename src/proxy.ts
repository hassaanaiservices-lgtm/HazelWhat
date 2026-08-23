import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/auth-session';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log(`[Proxy] Firing on route: ${pathname}`);

  const adminCookie = request.cookies.get('hazel_admin_session');
  const clientCookie = request.cookies.get('hazel_client_session');

  // Allow static assets, next internal files, and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // ========== ADMIN PANEL ROUTES ==========
  if (pathname.startsWith('/admin')) {
    // Old /admin/login redirect
    if (pathname === '/admin/login') {
      if (adminCookie && adminCookie.value) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      return NextResponse.redirect(new URL('/login?portal=admin', request.url));
    }

    // If no admin session, redirect to admin login
    if (!adminCookie || !adminCookie.value) {
      return NextResponse.redirect(new URL('/login?portal=admin', request.url));
    }

    // Validate admin role
    try {
      const session = await verifyJWT(adminCookie.value);
      if (!session || session.role !== 'admin') {
        // Not an admin - clear bad cookie and redirect
        const res = NextResponse.redirect(new URL('/login?portal=admin', request.url));
        res.cookies.delete('hazel_admin_session');
        return res;
      }
    } catch (e) {
      const res = NextResponse.redirect(new URL('/login?portal=admin', request.url));
      res.cookies.delete('hazel_admin_session');
      return res;
    }

    return NextResponse.next();
  }

  // ========== CLIENT PANEL ROUTES ==========
  if (pathname.startsWith('/client')) {
    // If no client session, redirect to client login
    if (!clientCookie || !clientCookie.value) {
      return NextResponse.redirect(new URL('/login?portal=client', request.url));
    }

    // Validate client role
    try {
      const session = await verifyJWT(clientCookie.value);
      if (!session || session.role !== 'client') {
        const res = NextResponse.redirect(new URL('/login?portal=client', request.url));
        res.cookies.delete('hazel_client_session');
        return res;
      }
    } catch (e) {
      const res = NextResponse.redirect(new URL('/login?portal=client', request.url));
      res.cookies.delete('hazel_client_session');
      return res;
    }

    return NextResponse.next();
  }

  // ========== LOGIN PAGE ==========
  if (pathname === '/login') {
    // If admin is already logged in and portal=admin, redirect to /admin
    if (adminCookie && adminCookie.value) {
      try {
        const params = request.nextUrl.searchParams;
        if (params.get('portal') === 'admin') {
          const session = await verifyJWT(adminCookie.value);
          if (session && session.role === 'admin') {
            return NextResponse.redirect(new URL('/admin', request.url));
          }
        }
      } catch (e) {}
    }

    // If client is already logged in and portal=client (or no portal specified), redirect to /client
    if (clientCookie && clientCookie.value) {
      try {
        const params = request.nextUrl.searchParams;
        const portal = params.get('portal');
        if (!portal || portal === 'client') {
          const session = await verifyJWT(clientCookie.value);
          if (session && session.role === 'client') {
            return NextResponse.redirect(new URL('/client', request.url));
          }
        }
      } catch (e) {}
    }

    return NextResponse.next();
  }

  // ========== LANDING PAGE (/) and everything else ==========
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/client',
    '/client/:path*',
    '/login',
  ],
};
