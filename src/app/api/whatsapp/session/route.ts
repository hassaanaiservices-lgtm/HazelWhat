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
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const tenantId = session?.tenantId;
    if (tenantId) {
      WhatsAppManager.setActiveTenantId(tenantId);
    }

    let status = WhatsAppManager.getStatus();
    
    if (status.status !== lastLoggedServerStatus) {
      lastLoggedServerStatus = status.status;
      console.log(`[Session API] GET status query. Tenant: ${tenantId || 'unknown'}. Connection Status: ${status.status.toUpperCase()}`);
    }
    
    // GET simply returns the current status without triggering background changes
    return NextResponse.json({ success: true, session: status });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookies(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const tenantId = session?.tenantId;
    if (tenantId) {
      WhatsAppManager.setActiveTenantId(tenantId);
    }

    // Parse optional body for { fresh: true } flag
    let fresh = false;
    try {
      const body = await request.json();
      fresh = !!body?.fresh;
    } catch (_) {}

    const tId = tenantId || WhatsAppManager.getActiveTenantId() || "default";

    if (fresh) {
      // Wipe stale Supabase + local auth so Baileys starts with a clean slate
      console.log(`[Session API] Fresh connect requested for tenant ${tId}. Clearing old credentials...`);
      const { useSupabaseAuthState } = await import("@/lib/whatsapp-auth");
      const { removeCreds } = await useSupabaseAuthState(tId);
      await removeCreds();
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

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionFromCookies(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    await WhatsAppManager.disconnect();
    return NextResponse.json({ success: true, message: "Disconnected successfully" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
