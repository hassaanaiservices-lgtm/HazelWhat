import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DB } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("hazel_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);

    if (session.role === "admin") {
      const tenants = await DB.getTenants();
      const defaultTenant = tenants[0] || null;
      return NextResponse.json({
        authenticated: true,
        user: session,
        tenant: defaultTenant
      });
    }

    // Fetch fresh tenant data for client directly from Supabase
    let tenant = await DB.getTenantById(session.tenantId);

    if (!tenant) {
      return NextResponse.json({ authenticated: false, error: "Tenant not found" }, { status: 404 });
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

  } catch (err: any) {
    return NextResponse.json({ authenticated: false, error: err.message }, { status: 500 });
  }
}
