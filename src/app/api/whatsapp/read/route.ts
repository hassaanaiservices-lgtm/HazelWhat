import { NextRequest, NextResponse } from "next/server";
import { WhatsAppManager } from "@/lib/whatsapp";
import { DB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth-session";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies(req);
    const tenantId = session?.tenantId;

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
