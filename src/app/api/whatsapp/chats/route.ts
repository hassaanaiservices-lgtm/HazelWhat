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

    const allChats = DB.getAllChats() || {};
    const rawCustomers = DB.getAllCustomers() || [];
    const customerList = Array.isArray(rawCustomers) ? rawCustomers : Object.values(rawCustomers);

    // Super Admin sees all chats
    if (session.role === 'admin') {
      return NextResponse.json({ success: true, chats: allChats, customers: customerList });
    }

    // Client sees ONLY chats & customers tagged with their specific tenantId
    const filteredChats: Record<string, any[]> = {};
    const filteredCustomers: any[] = [];

    customerList.forEach((c: any) => {
      if (c && c.tenantId === tenantId) {
        filteredCustomers.push(c);
        if (allChats[c.phone]) {
          filteredChats[c.phone] = allChats[c.phone];
        }
      }
    });

    // Also include any chat where message contains matching tenantId
    for (const [phone, chatList] of Object.entries(allChats)) {
      if (Array.isArray(chatList)) {
        const belongsToTenant = chatList.some((m: any) => m.tenantId === tenantId);
        if (belongsToTenant && !filteredChats[phone]) {
          filteredChats[phone] = chatList;
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      chats: filteredChats, 
      customers: filteredCustomers 
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
