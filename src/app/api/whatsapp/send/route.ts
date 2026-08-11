import { NextRequest, NextResponse } from "next/server";
import { WhatsAppManager } from "@/lib/whatsapp";
import { DB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth-session";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies(req);
    const tenantId = session?.tenantId;

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
      await DB.addChatMessage(to, { 
        id: "agent_" + (sentMsg?.key?.id || ""), 
        role: "assistant", 
        content: displayContent,
        mediaUrl: mediaBase64,
        mediaType: mimetype
      }, tenantId);
    } else {
      if (!content) {
        return NextResponse.json({ success: false, error: "Missing 'content'" }, { status: 400 });
      }
      sentMsg = await WhatsAppManager.sendMessage(to, content);
      await DB.addChatMessage(to, { id: "agent_" + (sentMsg?.key?.id || ""), role: "assistant", content }, tenantId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API/Send] Error sending message:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
