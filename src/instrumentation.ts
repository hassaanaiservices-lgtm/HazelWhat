export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { WhatsAppManager } = await import("@/lib/whatsapp");
      const { handleWhatsAppMessage } = await import("@/lib/ai-handler");

      console.log("[Server Startup] Auto-initializing WhatsApp Manager on boot...");
      WhatsAppManager.startSession(async (msg) => {
        await handleWhatsAppMessage(msg);
      }).catch((err) => {
        console.error("[Server Startup] Auto-connect error:", err);
      });
    } catch (e) {
      console.error("[Server Startup] Error in instrumentation register hook:", e);
    }
  }
}
