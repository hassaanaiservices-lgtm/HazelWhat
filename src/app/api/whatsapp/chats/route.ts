import { NextRequest, NextResponse } from "next/server";
import { DB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth-session";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies(req);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
    }

    const tenantId = session.tenantId;

    if (session.role === 'admin') {
      const queryTenantId = req.nextUrl.searchParams.get('tenantId');
      const targetTenantId = queryTenantId && queryTenantId !== 'admin' ? queryTenantId : undefined;
      const allChats = await DB.getAllChats(targetTenantId);
      const allCustomers = await DB.getAllCustomers(targetTenantId);
      return NextResponse.json({ success: true, chats: allChats, customers: allCustomers });
    }

    // Tenant-isolated chat and customer fetching
    let chats = await DB.getAllChats(tenantId);
    let customers = await DB.getAllCustomers(tenantId);

    // Fallback: If no chats exist under tenantId, check all chats to see if legacy messages exist for this tenant's customers or admin
    if (Object.keys(chats).length === 0) {
      const fallbackChats = await DB.getAllChats(null);
      const fallbackCustomers = await DB.getAllCustomers(tenantId);
      if (Object.keys(fallbackChats).length > 0) {
        chats = fallbackChats;
        if (customers.length === 0) {
          customers = fallbackCustomers;
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      chats, 
      customers 
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
