export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { WhatsAppManager } = await import("@/lib/whatsapp");
      const { handleWhatsAppMessage } = await import("@/lib/ai-handler");

      console.log("[Server Startup] Initializing WhatsApp session manager...");

      // Start background timers (follow-ups, sync, watchdog)
      // The watchdog will auto-discover ALL tenants with saved credentials in Supabase
      // and connect them within 2 seconds — no need to guess which tenant to start.
      WhatsAppManager.startSession(async (msg: any, tenantId: string) => {
        await handleWhatsAppMessage(msg, tenantId);
      }).catch((err: any) => {
        // startSession calls connectTenant("default") which may fail if no creds exist
        // This is expected — the watchdog will pick up real tenants.
        if (!String(err?.message).includes("Please connect WhatsApp")) {
          console.error("[Server Startup] Auto-connect error:", err);
        }
      });
    } catch (e) {
      console.error("[Server Startup] Error in instrumentation register hook:", e);
    }
  }
}
