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

    const { to, content, mediaBase64, mimetype, fileName, isVoiceNote } = await req.json();

    if (!to) {
      return NextResponse.json({ success: false, error: "Missing 'to'" }, { status: 400 });
    }

    let sentMsg;

    if (mediaBase64) {
      const base64Data = mediaBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      
      sentMsg = await WhatsAppManager.sendMedia(to, buffer, mimetype, fileName, undefined, isVoiceNote);
      
      const displayContent = isVoiceNote ? "🎤 [Voice Note]" : `📎 [Attachment] ${fileName || ""}`;
      await DB.addChatMessage(to, { id: sentMsg?.key?.id, role: "assistant", content: displayContent }, tenantId);
    } else {
      if (!content) {
        return NextResponse.json({ success: false, error: "Missing 'content'" }, { status: 400 });
      }
      sentMsg = await WhatsAppManager.sendMessage(to, content);
      await DB.addChatMessage(to, { id: sentMsg?.key?.id, role: "assistant", content }, tenantId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API/Send] Error sending message:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
