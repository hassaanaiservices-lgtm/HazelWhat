export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const path = await import("path");
      const fs = await import("fs");
      const { DB_DIR } = await import("@/lib/db");
      const { WhatsAppManager } = await import("@/lib/whatsapp");
      const { handleWhatsAppMessage } = await import("@/lib/ai-handler");

      const authFolder = path.join(DB_DIR, ".baileys_auth");
      const credsFile = path.join(authFolder, "creds.json");

      if (fs.existsSync(credsFile)) {
        console.log("[Server Startup] Saved WhatsApp credentials found. Auto-connecting on boot...");
        WhatsAppManager.startSession(async (msg) => {
          await handleWhatsAppMessage(msg);
        }).catch((err) => {
          console.error("[Server Startup] Auto-connect error:", err);
        });
      }
    } catch (e) {
      console.error("[Server Startup] Error in instrumentation register hook:", e);
    }
  }
}
