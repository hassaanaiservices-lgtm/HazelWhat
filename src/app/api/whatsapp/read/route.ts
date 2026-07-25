import { NextResponse } from "next/server";
import { WhatsAppManager } from "@/lib/whatsapp";
import { DB } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ success: false, error: "Missing 'phone'" }, { status: 400 });
    }

    const unreadIds = DB.getUnreadMessageIds(phone);
    if (unreadIds.length > 0) {
      await WhatsAppManager.markChatRead(phone, unreadIds);
      DB.markMessagesAsReadInDb(phone, unreadIds);
    }

    return NextResponse.json({ success: true, readCount: unreadIds.length });
  } catch (error: any) {
    console.error("[API/Read] Error marking as read:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
