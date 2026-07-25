import { NextRequest, NextResponse } from "next/server";
import { WhatsAppManager } from "@/lib/whatsapp";
import { handleWhatsAppMessage } from "@/lib/ai-handler";

export async function GET() {
  try {
    const status = WhatsAppManager.getStatus();
    return NextResponse.json({ success: true, session: status });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    // Start session and pass the AI handler for incoming messages
    await WhatsAppManager.startSession(async (msg) => {
      await handleWhatsAppMessage(msg);
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await WhatsAppManager.disconnect();
    return NextResponse.json({ success: true, message: "Disconnected successfully" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
