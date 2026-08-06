import { NextResponse } from "next/server";
import { WhatsAppManager } from "@/lib/whatsapp";
import { DB } from "@/lib/db";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("hazel_session");
    let tenantId: string | undefined;
    if (sessionCookie && sessionCookie.value) {
      try {
        const session = JSON.parse(sessionCookie.value);
        tenantId = session.role === 'admin' ? undefined : session.tenantId;
      } catch (e) {}
    }

    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ success: false, error: "Missing 'phone'" }, { status: 400 });
    }

    const unreadIds = await DB.getUnreadMessageIds(phone, tenantId);
    if (unreadIds.length > 0) {
      await WhatsAppManager.markChatRead(phone, unreadIds);
      await DB.markMessagesAsReadInDb(phone, unreadIds, tenantId);
    }

    return NextResponse.json({ success: true, readCount: unreadIds.length });
  } catch (error: any) {
    console.error("[API/Read] Error marking as read:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
