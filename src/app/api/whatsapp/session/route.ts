import { NextRequest, NextResponse } from "next/server";
import { WhatsAppManager } from "@/lib/whatsapp";
import { handleWhatsAppMessage } from "@/lib/ai-handler";
import { getSessionFromCookies } from "@/lib/auth-session";
import { DB, DB_DIR } from "@/lib/db";
import path from "path";
import fs from "fs";

let lastLoggedServerStatus: string | null = null;

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookies(request);
    const tenantId = session?.tenantId;
    if (tenantId) {
      WhatsAppManager.setActiveTenantId(tenantId);
    }

    let status = WhatsAppManager.getStatus();
    
    if (status.status !== lastLoggedServerStatus) {
      lastLoggedServerStatus = status.status;
      console.log(`[Session API] GET status query. Tenant: ${tenantId || 'unknown'}. Connection Status: ${status.status.toUpperCase()}`);
    }
    
    // Auto-reconnect if auth credentials exist but session is disconnected
    if (status.status === "disconnected") {
      const authFolder = path.join(DB_DIR, ".baileys_auth");
      const credsFile = path.join(authFolder, "creds.json");
      
      const hasLocalCreds = fs.existsSync(credsFile);
      const hasSupabaseCreds = await DB.hasSavedCredentials("default");

      if (hasLocalCreds || hasSupabaseCreds) {
        console.log("[Session Route] Saved credentials found. Auto-connecting WhatsApp...");
        WhatsAppManager.startSession(async (msg) => {
          await handleWhatsAppMessage(msg, tenantId);
        }).catch(err => {
          console.error("[Session Route] Auto-connect failed:", err);
        });
        
        status = {
          status: "connecting",
          qrCode: null,
          qrGeneratedAt: null,
          phoneNumber: undefined,
          displayName: "WhatsApp Business",
          lastError: null,
          lastStatusCode: null,
          reconnectAttempts: 0
        };
      }
    }
    
    return NextResponse.json({ success: true, session: status });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookies(request);
    const tenantId = session?.tenantId;
    if (tenantId) {
      WhatsAppManager.setActiveTenantId(tenantId);
    }

    await WhatsAppManager.softReset();
    await WhatsAppManager.startSession(async (msg) => {
      await handleWhatsAppMessage(msg, tenantId);
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
