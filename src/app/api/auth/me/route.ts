import { NextRequest, NextResponse } from "next/server";
import { DB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth-session";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const portal = searchParams.get('portal');
    const session = await getSessionFromCookies(request);

    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Fast-path: Return JWT session data immediately if available
    let tenant: any = null;
    let targetTenantId = session.tenantId;

    if (session.role === 'admin' && (!targetTenantId || targetTenantId === 'admin')) {
      targetTenantId = 't-1007'; // Default active workspace fallback
    }

    try {
      // Fast 1.5s race for DB metadata so page load NEVER hangs
      tenant = await Promise.race([
        DB.getTenantById(targetTenantId),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))
      ]);
    } catch (e) {
      tenant = null;
    }

    const tenantIdFinal = tenant?.id || targetTenantId || session.tenantId || "t-1007";
    const businessNameFinal = tenant?.businessName || tenant?.name || session.businessName || session.name || "HazelWhat Workspace";

    return NextResponse.json({
      authenticated: true,
      user: {
        ...session,
        tenantId: tenantIdFinal,
        name: tenant?.name || session.name || "Client Account",
        businessName: businessNameFinal,
        email: tenant?.email || session.email,
        status: tenant?.status || 'active',
        allocatedMinutes: tenant?.allocatedMinutes || 1000,
        usedMinutes: tenant?.usedMinutes || 0,
      },
      tenant: tenant || { id: tenantIdFinal, businessName: businessNameFinal }
    });

  } catch (err: any) {
    return NextResponse.json({ authenticated: false, error: err.message }, { status: 500 });
  }
}
