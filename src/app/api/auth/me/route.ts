import { NextRequest, NextResponse } from "next/server";
import { DB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth-session";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const portal = searchParams.get('portal');
    const session = await getSessionFromCookies(request);

    // ========== ADMIN PORTAL CHECK ==========
    if (portal === 'admin') {
      if (!session || session.role !== 'admin') {
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

    // ========== CLIENT PORTAL CHECK ==========
    if (portal === 'client') {
      if (!session) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
      }

      let targetTenantId = session.tenantId;
      if (session.role === 'admin' && (!targetTenantId || targetTenantId === 'admin')) {
        const tenants = await DB.getTenants();
        const activeTenant = tenants.find(t => t.status !== 'suspended' && t.status !== 'blocked') || tenants[0];
        if (activeTenant) targetTenantId = activeTenant.id;
      }

      const tenant = (await DB.getTenantById(targetTenantId)) || (await DB.getTenantByUsername(session.username || ""));
      if (!tenant) {
        console.error(`[Auth] Tenant not found for session:`, session);
        const res = NextResponse.json({ authenticated: false, error: "Tenant not found or invalid session" }, { status: 401 });
        res.cookies.delete('hazel_client_session');
        return res;
      }

      const statusLower = (tenant.status || 'active').trim().toLowerCase();
      if (statusLower === 'suspended' || statusLower === 'blocked' || statusLower === 'draft') {
        return NextResponse.json({ authenticated: false, error: "Account inactive or suspended" }, { status: 403 });
      }

      return NextResponse.json({
        authenticated: true,
        user: {
          ...session,
          tenantId: tenant.id,
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

    // ========== NO PORTAL SPECIFIED — check both ==========
    if (session) {
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

      if (session.role === 'client') {
        const tenant = (await DB.getTenantById(session.tenantId)) || (await DB.getTenantByUsername(session.username || ""));
        const stLower = (tenant?.status || 'active').trim().toLowerCase();
        if (tenant && stLower !== 'suspended' && stLower !== 'blocked' && stLower !== 'draft') {
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
    }

    return NextResponse.json({ authenticated: false }, { status: 401 });

  } catch (err: any) {
    return NextResponse.json({ authenticated: false, error: err.message }, { status: 500 });
  }
}
