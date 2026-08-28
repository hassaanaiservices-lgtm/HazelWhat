import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { handleWhatsAppMessage } from "@/lib/ai-handler";

/**
 * POST /api/whatsapp/simulate-bulk
 * 
 * Load-testing endpoint: Injects a synthetic WhatsApp message directly into
 * the AI processing pipeline (handleWhatsAppMessage → queue → worker).
 * Bypasses the real WhatsApp socket.
 * 
 * Body: { phone: string; message: string; tenantId?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies(req);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { phone, message, tenantId: bodyTenantId } = await req.json();
    if (!phone || !message) {
      return NextResponse.json({ success: false, error: "phone and message are required" }, { status: 400 });
    }

    const resolvedTenantId = bodyTenantId || session.tenantId;

    // Build a synthetic WhatsApp message object matching Baileys message format
    const syntheticMsg = {
      key: {
        remoteJid: `${phone}@s.whatsapp.net`,
        fromMe: false,
        id: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: `TestUser_${phone.slice(-4)}`,
      message: {
        conversation: message,
      },
    };

    // Fire and forget — don't await, let the queue handle it
    handleWhatsAppMessage(syntheticMsg, resolvedTenantId).catch((err: any) => {
      console.error(`[SimulateBulk] Error for ${phone}:`, err.message);
    });

    return NextResponse.json({ success: true, phone, queued: true });
  } catch (error: any) {
    console.error("[SimulateBulk] Error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
