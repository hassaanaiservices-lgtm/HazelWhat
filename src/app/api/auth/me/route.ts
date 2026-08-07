import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DB } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const { searchParams } = new URL(request.url);
    const portal = searchParams.get('portal');

    // ========== ADMIN SESSION CHECK ==========
    if (portal === 'admin') {
      const adminCookie = cookieStore.get("hazel_admin_session");
      if (!adminCookie || !adminCookie.value) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
      }

      const session = JSON.parse(adminCookie.value);
      if (session.role !== 'admin') {
        return NextResponse.json({ authenticated: false }, { status: 401 });
      }

      const tenants = await DB.getTenants();
      const defaultTenant = tenants[0] || null;
      return NextResponse.json({
        authenticated: true,
        user: {
          ...session,
          businessName: defaultTenant?.businessName || defaultTenant?.name || "HazelWhat Workspace"
        },
        tenant: defaultTenant
      });
    }

    // ========== CLIENT SESSION CHECK ==========
    if (portal === 'client') {
      const clientCookie = cookieStore.get("hazel_client_session");
      if (!clientCookie || !clientCookie.value) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
      }

      const session = JSON.parse(clientCookie.value);
      if (session.role !== 'client') {
        return NextResponse.json({ authenticated: false }, { status: 401 });
      }

      let tenant = (await DB.getTenantById(session.tenantId)) || (await DB.getTenantByUsername(session.username || session.clientUsername || ""));
      if (!tenant) {
        console.error(`[Auth] Tenant not found for session:`, session);
        const res = NextResponse.json({ authenticated: false, error: "Tenant not found or invalid session" }, { status: 401 });
        res.cookies.delete('hazel_client_session');
        return res;
      }
      if (tenant.status !== "active") {
        return NextResponse.json({ authenticated: false, error: "Account inactive or suspended" }, { status: 403 });
      }

      return NextResponse.json({
        authenticated: true,
        user: {
          ...session,
          name: tenant.name,
          businessName: tenant.businessName,
          email: tenant.email,
          status: tenant.status,
          allocatedMinutes: tenant.allocatedMinutes,
          usedMinutes: tenant.usedMinutes,
        },
        tenant
      });
    }

    // ========== NO PORTAL SPECIFIED — check both (for landing page navbar etc.) ==========
    // Check admin session first
    const adminCookie = cookieStore.get("hazel_admin_session");
    if (adminCookie && adminCookie.value) {
      try {
        const session = JSON.parse(adminCookie.value);
        if (session.role === 'admin') {
          const tenants = await DB.getTenants();
          const defaultTenant = tenants[0] || null;
          return NextResponse.json({
            authenticated: true,
            user: {
              ...session,
              businessName: defaultTenant?.businessName || defaultTenant?.name || "HazelWhat Workspace"
            },
            tenant: defaultTenant
          });
        }
      } catch (e) {}
    }

    // Then check client session
    const clientCookie = cookieStore.get("hazel_client_session");
    if (clientCookie && clientCookie.value) {
      try {
        const session = JSON.parse(clientCookie.value);
        if (session.role === 'client') {
          let tenant = (await DB.getTenantById(session.tenantId)) || (await DB.getTenantByUsername(session.username || session.clientUsername || ""));
          if (tenant && tenant.status === "active") {
            return NextResponse.json({
              authenticated: true,
              user: {
                ...session,
                name: tenant.name,
                businessName: tenant.businessName,
                email: tenant.email,
                status: tenant.status,
                allocatedMinutes: tenant.allocatedMinutes,
                usedMinutes: tenant.usedMinutes,
              },
              tenant
            });
          }
        }
      } catch (e) {}
    }

    // Also check old unified cookie for backward compat
    const oldCookie = cookieStore.get("hazel_session");
    if (oldCookie && oldCookie.value) {
      try {
        const session = JSON.parse(oldCookie.value);
        return NextResponse.json({ authenticated: true, user: session });
      } catch (e) {}
    }

    return NextResponse.json({ authenticated: false }, { status: 401 });

  } catch (err: any) {
    return NextResponse.json({ authenticated: false, error: err.message }, { status: 500 });
  }
}
