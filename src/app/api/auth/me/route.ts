import { NextRequest, NextResponse } from "next/server";
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
      return NextResponse.json({
        authenticated: true,
        user: session
      });
    }

    // Fetch fresh tenant data for client
    const tenants = DB.getTenants();
    const tenant = tenants.find(t => t.id === session.tenantId);

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
