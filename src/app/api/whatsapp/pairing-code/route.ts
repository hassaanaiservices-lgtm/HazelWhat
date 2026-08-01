import { NextRequest, NextResponse } from "next/server";
import { WhatsAppManager } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber } = await req.json();
    if (!phoneNumber) {
      return NextResponse.json({ success: false, error: "Phone number is required" }, { status: 400 });
    }

    const code = await WhatsAppManager.requestPairingCode(phoneNumber);
    return NextResponse.json({ success: true, pairingCode: code });
  } catch (err: any) {
    console.error("[Pairing Code Route] Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to generate pairing code" }, { status: 500 });
  }
}
