import { NextRequest, NextResponse } from "next/server";
import { DB } from "@/lib/db";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("hazel_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);
    const tenantId = session.tenantId;

    if (session.role === 'admin') {
      const allChats = await DB.getAllChats('admin');
      const allCustomers = await DB.getAllCustomers('admin');
      return NextResponse.json({ success: true, chats: allChats, customers: allCustomers });
    }

    // Tenant-isolated chat and customer fetching
    const chats = await DB.getAllChats(tenantId);
    const customers = await DB.getAllCustomers(tenantId);

    return NextResponse.json({ 
      success: true, 
      chats, 
      customers 
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
