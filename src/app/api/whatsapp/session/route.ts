import { NextRequest, NextResponse } from "next/server";
import { WhatsAppManager } from "@/lib/whatsapp";
import { handleWhatsAppMessage } from "@/lib/ai-handler";

import path from "path";
import fs from "fs";

export async function GET() {
  try {
    let status = WhatsAppManager.getStatus();
    
    // Auto-reconnect if auth credentials exist but session is disconnected
    if (status.status === "disconnected") {
      const authFolder = path.join(process.cwd(), ".data", ".baileys_auth");
      const credsFile = path.join(authFolder, "creds.json");
      
      if (fs.existsSync(credsFile)) {
        console.log("[Session Route] Saved credentials found. Auto-connecting WhatsApp...");
        // Start session asynchronously
        WhatsAppManager.startSession(async (msg) => {
          await handleWhatsAppMessage(msg);
        }).catch(err => {
          console.error("[Session Route] Auto-connect failed:", err);
        });
        
        // Update status representation to show connecting
        status = {
          status: "connecting",
          qrCode: null,
          qrGeneratedAt: null,
          phoneNumber: undefined,
          displayName: "WhatsApp Business"
        };
      }
    }
    
    return NextResponse.json({ success: true, session: status });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    // Soft reset: close existing socket and delete local credentials
    // without calling logout() (which would deregister the device on
    // WhatsApp servers and cause "Couldn't link device" errors).
    await WhatsAppManager.softReset();
    
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
