import { makeWASocket, useMultiFileAuthState, DisconnectReason, WAMessageStatus, downloadMediaMessage, generateWAMessageFromContent, prepareWAMessageMedia } from "@whiskeysockets/baileys";
import { DB } from "./db";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import pino from "pino";
import path from "path";
import fs from "fs";
import { scrapeStore } from "./scraper";
const globalForBaileys = global as unknown as {
  baileysSession: any;
  autoSyncInterval: any;
  followUpInterval: any;
  reconnectTimeout: any;
};

if (!globalForBaileys.baileysSession) {
  globalForBaileys.baileysSession = { status: "disconnected", qrCode: null, sock: null };
}

export class WhatsAppManager {
  static startAutoSync() {
    if (globalForBaileys.autoSyncInterval) {
      clearInterval(globalForBaileys.autoSyncInterval);
    }
    // Run every 6 hours (21600000 ms)
    globalForBaileys.autoSyncInterval = setInterval(async () => {
      try {
        const config = DB.getConfig();
        if (config.storeUrl) {
          console.log("[Auto-Sync] Scraping store catalog from:", config.storeUrl);
          const { catalog } = await scrapeStore(config.storeUrl, config.storeCurrency || "$");
          if (catalog) {
            // Keep the non-catalog part of productInfo and append the new catalog
            const parts = config.productInfo.split("--- E-COMMERCE CATALOG ---");
            const baseInfo = parts[0].trim();
            DB.updateConfig({ productInfo: baseInfo + "\n\n" + catalog });
            console.log("[Auto-Sync] Successfully updated Knowledge Base with latest catalog.");
          }
        }
      } catch (e) {
        console.error("[Auto-Sync] Failed to sync catalog:", e);
      }
    }, 21600000);
  }

  static startFollowUpsSync() {
    if (globalForBaileys.followUpInterval) {
      clearInterval(globalForBaileys.followUpInterval);
    }
    // Run every 15 seconds for higher precision
    globalForBaileys.followUpInterval = setInterval(async () => {
      try {
        const config = DB.getConfig();
        const now = Date.now();
        const { generateContextualFollowUp, generateScheduledFollowUp } = await import('./ai-handler');
        
        // --- SYSTEM A: Proactive AI-Scheduled Follow-ups ---
        const pendingSystemAFollowUps = DB.getPendingFollowUps();
        for (const fu of pendingSystemAFollowUps) {
          const sendAtMs = new Date(fu.sendAt).getTime();
          if (now >= sendAtMs) {
            console.log(`[System A Follow-up] Triggering scheduled follow-up for ${fu.phone}`);
            
            try {
              const aiMessage = await generateScheduledFollowUp(fu.phone, fu.context);
              const sentMsg = await this.sendMessage(fu.phone, aiMessage);
              
              DB.addChatMessage(fu.phone, { id: sentMsg?.key?.id, role: "assistant", content: aiMessage });
              DB.updateFollowUpStatus(fu.id, "sent");
            } catch (err) {
              console.error(`[System A Follow-up] Failed to send to ${fu.phone}:`, err);
              DB.updateFollowUpStatus(fu.id, "failed");
            }
          }
        }

        // Re-fetch in case statuses just changed to 'sent'
        const stillPendingSystemA = DB.getPendingFollowUps();
        const chats = DB.getAllChats();
        const orders = DB.getOrders();
        const pendingOrders = orders.filter(o => o.status === "pending");
        
        // --- SYSTEM C: Abandoned Order Recovery Engine ---
        console.log(`\n--- [Cron Tick] System C Abandoned Order Check @ ${new Date(now).toLocaleTimeString()} ---`);
        for (const order of pendingOrders) {
          const phone = order.phone;
          const messages = chats[phone];
          if (!messages || messages.length === 0) continue;
          
          const lastMessage = messages[messages.length - 1];
          // We only recover order if the bot was the last to speak (waiting for details)
          if (lastMessage.role !== 'assistant') {
            console.log(`[System C Recovery] Skipping ${phone}: Last message was from user.`);
            continue;
          }

          const elapsedMs = now - new Date(order.timestamp).getTime();
          const elapsedMinutes = elapsedMs / (1000 * 60);
          const currentStage = order.recoveryStage || 0;

          // Stage 1: 30 minutes (30 mins)
          if (currentStage < 1 && elapsedMinutes >= 30) {
            console.log(`[System C Recovery] Triggering Stage 1 for order ${order.id} (${phone})`);
            try {
              const template = `Hey! I noticed we got cut off while finalizing your order for the ${order.productName}. I've gone ahead and reserved one in our system for you. Where would you like me to ship it?`;
              const contextualMessage = await generateContextualFollowUp(phone, template);
              const sentMsg = await this.sendMessage(phone, contextualMessage);
              
              DB.addChatMessage(phone, { id: sentMsg?.key?.id, role: "assistant", content: contextualMessage });
              DB.updateOrder(order.id, { recoveryStage: 1 });
            } catch (err) {
              console.error(`[System C Stage 1] Failed for ${phone}:`, err);
            }
          }
          // Stage 2: 6 hours (360 mins)
          else if (currentStage < 2 && elapsedMinutes >= 360) {
            console.log(`[System C Recovery] Triggering Stage 2 for order ${order.id} (${phone})`);
            try {
              const template = `Hi! Just a quick heads-up: we have a lot of interest in the ${order.productName} today, and I can only hold your reservation for another hour before releasing it. Would you like to confirm your details to secure it?`;
              const contextualMessage = await generateContextualFollowUp(phone, template);
              const sentMsg = await this.sendMessage(phone, contextualMessage);
              
              DB.addChatMessage(phone, { id: sentMsg?.key?.id, role: "assistant", content: contextualMessage });
              DB.updateOrder(order.id, { recoveryStage: 2 });
            } catch (err) {
              console.error(`[System C Stage 2] Failed for ${phone}:`, err);
            }
          }
          // Stage 3: 24 hours (1440 mins)
          else if (currentStage < 3 && elapsedMinutes >= 1440) {
            console.log(`[System C Recovery] Triggering Stage 3 for order ${order.id} (${phone})`);
            try {
              const template = `Hey! I really want to help you get this outfit. If we finalize your order for the ${order.productName} today, I can throw in free shipping. Let me know if you want me to add that in! 🎁`;
              const contextualMessage = await generateContextualFollowUp(phone, template);
              const sentMsg = await this.sendMessage(phone, contextualMessage);
              
              DB.addChatMessage(phone, { id: sentMsg?.key?.id, role: "assistant", content: contextualMessage });
              DB.updateOrder(order.id, { recoveryStage: 3 });
            } catch (err) {
              console.error(`[System C Stage 3] Failed for ${phone}:`, err);
            }
          }
          // Stage 4: 48 hours (2880 mins)
          else if (currentStage < 4 && elapsedMinutes >= 2880) {
            console.log(`[System C Recovery] Triggering Stage 4 for order ${order.id} (${phone})`);
            try {
              const template = `Hi, since we haven't heard back, I've cancelled your pending order for the ${order.productName} and released the hold on the stock. If you decide to order it later, just send me a message here.`;
              const contextualMessage = await generateContextualFollowUp(phone, template);
              const sentMsg = await this.sendMessage(phone, contextualMessage);
              
              DB.addChatMessage(phone, { id: sentMsg?.key?.id, role: "assistant", content: contextualMessage });
              DB.updateOrder(order.id, { recoveryStage: 4, status: "cancelled" });
            } catch (err) {
              console.error(`[System C Stage 4] Failed for ${phone}:`, err);
            }
          }
        }

        // --- SYSTEM B: Generic Sequence Follow-ups ---
        if (!config.followUps || config.followUps.length === 0) return;
        
        console.log(`\n--- [Cron Tick] System B Follow-up Check @ ${new Date(now).toLocaleTimeString()} ---`);

        for (const phone in chats) {
          const messages = chats[phone];
          if (!messages || messages.length === 0) continue;
          
          const lastMessage = messages[messages.length - 1];
          const elapsedMs = now - new Date(lastMessage.timestamp).getTime();
          const elapsedMinutes = (elapsedMs / (1000 * 60)).toFixed(2);
          const customer = DB.getCustomer(phone);
          const followUpLevel = customer?.followUpLevel || 0;
          const nextFollowUp = config.followUps[followUpLevel];
          const requiredMinutes = nextFollowUp?.delayMinutes || 0;
          const exceedsWait = elapsedMs >= (requiredMinutes * 60 * 1000);

          console.log(`[Phone: ${phone}] Last Msg: ${lastMessage.role} @ ${new Date(lastMessage.timestamp).toLocaleTimeString()} | Elapsed: ${elapsedMinutes}m | Required: ${requiredMinutes}m | Meets Time: ${exceedsWait} | Level: ${followUpLevel}`);

          // We only follow up if the bot was the last one to speak
          if (lastMessage.role !== 'assistant') {
            console.log(`  -> Skipping ${phone}: Last message was from user.`);
            continue;
          }

          // We only follow up if there is an active conversation (at least one user message)
          const hasUserMessage = messages.some(m => m.role === 'user');
          if (!hasUserMessage) {
            console.log(`  -> Skipping ${phone}: No user message in history (broadcast only).`);
            continue;
          }

          // CONFLICT RESOLUTION 1: Skip System B if System A has a pending follow-up for this customer
          const hasPendingSystemA = stillPendingSystemA.some(f => f.phone === phone);
          if (hasPendingSystemA) {
            console.log(`  -> Skipping ${phone}: System A has a pending follow-up.`);
            continue;
          }

          // CONFLICT RESOLUTION 2: Skip System B if customer has an active pending order (handled by System C)
          const hasPendingOrder = pendingOrders.some(o => o.phone === phone);
          if (hasPendingOrder) {
            console.log(`  -> Skipping ${phone}: Customer has a pending order (handled by System C).`);
            continue;
          }

          // If all 5 follow ups sent, stop and mark as cold lead
          if (followUpLevel >= 5) {
            console.log(`  -> Skipping ${phone}: Max follow-up level (5) reached.`);
            if (customer?.leadStatus !== "cold") DB.updateCustomer(phone, { leadStatus: "cold" });
            continue;
          }

          if (!nextFollowUp || !nextFollowUp.enabled) {
            console.log(`  -> Skipping ${phone}: Follow-up level ${followUpLevel} is disabled or missing.`);
            if (customer?.leadStatus !== "cold") DB.updateCustomer(phone, { leadStatus: "cold" });
            continue;
          }

          const delayMs = nextFollowUp.delayMinutes * 60 * 1000;
          if (elapsedMs >= delayMs) {
            console.log(`[System B Follow-up] Triggering Sequence Level ${followUpLevel + 1} for ${phone}`);
            
            try {
              const contextualMessage = await generateContextualFollowUp(phone, nextFollowUp.message);
              const sentMsg = await this.sendMessage(phone, contextualMessage);
              
              DB.addChatMessage(phone, { id: sentMsg?.key?.id, role: "assistant", content: contextualMessage });
              DB.updateCustomer(phone, { followUpLevel: followUpLevel + 1 });
            } catch (err) {
              console.error(`[System B Follow-up] Error sending to ${phone}:`, err);
            }
          }
        }
      } catch (e) {
        console.error("[Follow-up Loop] Global Error during sync:", e);
      }
    }, 60000); // 1 minute interval
  }

  static async startSession(onMessage: (msg: any) => void) {
    if (!globalForBaileys.autoSyncInterval) {
      this.startAutoSync();
    }
    if (!globalForBaileys.followUpInterval) {
      this.startFollowUpsSync();
    }

    if (globalForBaileys.baileysSession.status === "connected" || (globalForBaileys.baileysSession.status === "connecting" && globalForBaileys.baileysSession.sock)) {
      console.log(`[Baileys] startSession called but socket is already ${globalForBaileys.baileysSession.status}. Returning existing instance.`);
      return globalForBaileys.baileysSession.sock;
    }

    const authFolder = path.join(process.cwd(), ".data", ".baileys_auth");
    if (!fs.existsSync(authFolder)) {
      fs.mkdirSync(authFolder, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    const logger = pino({ level: "silent" });

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger,
      browser: ["HazelWhat SaaS", "Chrome", "1.0.0"],
    });

    globalForBaileys.baileysSession = { sock, status: "connecting", qrCode: null };

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrCodeDataUri = await QRCode.toDataURL(qr);
          globalForBaileys.baileysSession.status = "connecting";
          globalForBaileys.baileysSession.qrCode = qrCodeDataUri;
        } catch (err) {
          console.error("[Baileys] Error generating QR:", err);
        }
      }

      if (connection === "close") {
        // If we explicitly disconnected, do not reconnect
        if (globalForBaileys.baileysSession.status === "disconnected") {
          console.log("[Baileys] Socket closed after explicit disconnect. Skipping reconnect.");
          return;
        }

        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log(`[Baileys] Connection closed. Reason code: ${statusCode || 'unknown'}. Should reconnect: ${shouldReconnect}`);
        
        if (shouldReconnect) {
          globalForBaileys.baileysSession.status = "connecting";
          // Check if we are already trying to reconnect to prevent duplicate attempts
          if (!globalForBaileys.reconnectTimeout) {
            globalForBaileys.reconnectTimeout = setTimeout(() => {
              globalForBaileys.reconnectTimeout = null;
              this.startSession(onMessage).catch(err => console.error("[Baileys] Reconnect failed:", err));
            }, 5000); // 5 seconds wait is safer
          }
        } else {
          console.log("[Baileys] Logged out. Setting status to disconnected, but preserving credentials. They will only be deleted if the user explicitly disconnects.");
          globalForBaileys.baileysSession.status = "disconnected";
          globalForBaileys.baileysSession.qrCode = null;
          globalForBaileys.baileysSession.sock = null;
        }
      } else if (connection === "open") {
        globalForBaileys.baileysSession.status = "connected";
        globalForBaileys.baileysSession.qrCode = null;
        if (globalForBaileys.reconnectTimeout) {
          clearTimeout(globalForBaileys.reconnectTimeout);
          globalForBaileys.reconnectTimeout = null;
        }
      }
    });

    sock.ev.on("messages.upsert", async (m) => {
      if (m.type === "notify") {
        for (const msg of m.messages) {
          if (!msg.key.fromMe && msg.message) {
            onMessage(msg);
          } else if (msg.key.fromMe && msg.message) {
            // Message sent by the bot owner (e.g. from their actual phone or by our code)
            const textContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "";
            const hasImage = !!msg.message?.imageMessage;
            const content = hasImage ? `[Image] ${textContent}` : textContent;
            
            if (content) {
              let from = msg.key.remoteJid;
              if (from?.includes("@lid") && msg.key.remoteJidAlt) {
                from = msg.key.remoteJidAlt;
              }
              from = from?.replace("@s.whatsapp.net", "")?.replace("@lid", "");
              
              if (from) {
                const history = DB.getChats(from);
                const exists = history.some((chatMsg: any) => chatMsg.id === msg.key.id);
                if (!exists) {
                  // Save the owner's manual message as 'assistant' so it appears on the dashboard
                  DB.addChatMessage(from, { id: msg.key.id || undefined, role: "assistant", content });
                }
              }
            }
          }
        }
      }
    });

    sock.ev.on("messages.update", (updates) => {
      for (const { key, update } of updates) {
        if (key.id && update.status) {
          DB.updateMessageStatus(key.id, update.status);
        }
      }
    });

    sock.ev.on("messaging-history.set", ({ contacts, messages, isLatest }) => {
      // Sync contacts
      for (const contact of contacts) {
        if (contact.id && !contact.id.includes("@g.us") && !contact.id.includes("@lid")) {
          const phone = contact.id.replace("@s.whatsapp.net", "");
          if (phone) {
            DB.updateCustomer(phone, { name: contact.name || contact.notify || phone });
          }
        }
      }

      // Sync historical messages if available
      if (messages) {
        for (const msg of messages) {
          if (!msg.key.remoteJid?.includes("@g.us")) {
            const content = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
            if (content) {
              let from = msg.key.remoteJid;
              if (from?.includes("@lid")) {
                if (msg.key.remoteJidAlt) {
                  from = msg.key.remoteJidAlt;
                } else {
                  continue; // Skip ghost chat if real number is unknown
                }
              }
              from = from?.replace("@s.whatsapp.net", "");
              
              if (from) {
                const history = DB.getChats(from);
                const exists = history.some((chatMsg: any) => chatMsg.id === msg.key.id);
                if (!exists) {
                  const timestampStr = msg.messageTimestamp 
                    ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
                    : new Date().toISOString();
                    
                  DB.addChatMessage(from, { 
                    id: msg.key.id || undefined, 
                    role: msg.key.fromMe ? "assistant" : "user", 
                    content,
                    timestamp: timestampStr
                  });
                }
              }
            }
          }
        }
      }
    });

    sock.ev.on("contacts.upsert", (contacts) => {
      for (const contact of contacts) {
        if (contact.id && !contact.id.includes("@g.us") && !contact.id.includes("@lid")) {
          const phone = contact.id.replace("@s.whatsapp.net", "");
          if (phone) {
            DB.updateCustomer(phone, { name: contact.name || contact.notify || phone });
          }
        }
      }
    });

    return sock;
  }

  static getStatus() {
    return {
      status: globalForBaileys.baileysSession.status,
      qrCode: globalForBaileys.baileysSession.qrCode,
      phoneNumber: globalForBaileys.baileysSession.sock?.user?.id?.split(":")[0],
      displayName: globalForBaileys.baileysSession.sock?.user?.name || "WhatsApp Business",
    };
  }

  static async disconnect() {
    if (globalForBaileys.baileysSession.sock) {
      try {
        globalForBaileys.baileysSession.sock.logout();
      } catch (e) {}
      try {
        globalForBaileys.baileysSession.sock.end(undefined);
      } catch (e) {}
    }
    
    // Allow time for graceful shutdown and file locks to release
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    globalForBaileys.baileysSession = { status: "disconnected", qrCode: null, sock: null };
    
    const authFolder = path.join(process.cwd(), ".baileys_auth");
    if (fs.existsSync(authFolder)) {
      try {
        fs.rmSync(authFolder, { recursive: true, force: true });
      } catch (e) {
        console.error("Failed to delete auth folder:", e);
      }
    }
  }

  static async sendTyping(to: string) {
    if (globalForBaileys.baileysSession.status !== "connected" || !globalForBaileys.baileysSession.sock) return;
    const jid = to.includes("@") ? to : `${to.replace(/[^\d+]/g, "")}@s.whatsapp.net`;
    await globalForBaileys.baileysSession.sock.sendPresenceUpdate('composing', jid);
  }

  static async sendMessage(to: string, text: string) {
    if (globalForBaileys.baileysSession.status !== "connected" || !globalForBaileys.baileysSession.sock) {
      throw new Error("WhatsApp not connected");
    }
    const jid = to.includes("@") ? to : `${to.replace(/[^\d+]/g, "")}@s.whatsapp.net`;
    await globalForBaileys.baileysSession.sock.sendPresenceUpdate('paused', jid);
    const sentMsg = await globalForBaileys.baileysSession.sock.sendMessage(jid, { text });
    return sentMsg;
  }

  static async sendMedia(to: string, buffer: Buffer, mimetype: string, fileName?: string, isVoiceNote = false) {
    if (globalForBaileys.baileysSession.status !== "connected" || !globalForBaileys.baileysSession.sock) {
      throw new Error("WhatsApp not connected");
    }
    const jid = to.includes("@") ? to : `${to.replace(/[^\d+]/g, "")}@s.whatsapp.net`;
    
    let msgObj: any = {};
    if (isVoiceNote || mimetype.startsWith('audio/')) {
        await globalForBaileys.baileysSession.sock.sendPresenceUpdate('recording', jid);
        // Sometimes WhatsApp expects mp4 or ogg. The ptt flag sets it as a voice note.
        msgObj = { audio: buffer, ptt: isVoiceNote, mimetype: mimetype || 'audio/mp4' };
    } else if (mimetype.startsWith('image/')) {
        await globalForBaileys.baileysSession.sock.sendPresenceUpdate('paused', jid);
        msgObj = { image: buffer, caption: fileName };
    } else if (mimetype.startsWith('video/')) {
        await globalForBaileys.baileysSession.sock.sendPresenceUpdate('paused', jid);
        msgObj = { video: buffer, caption: fileName };
    } else {
        await globalForBaileys.baileysSession.sock.sendPresenceUpdate('paused', jid);
        msgObj = { document: buffer, mimetype, fileName: fileName || "document" };
    }
    const sentMsg = await globalForBaileys.baileysSession.sock.sendMessage(jid, msgObj);
    return sentMsg;
  }

  static async markChatRead(phone: string, messageIds: string[]) {
    if (globalForBaileys.baileysSession.status !== "connected" || !globalForBaileys.baileysSession.sock || !messageIds.length) return;
    const jid = phone.includes("@") ? phone : `${phone.replace(/[^\d+]/g, "")}@s.whatsapp.net`;
    const keys = messageIds.map(id => ({ remoteJid: jid, id, fromMe: false }));
    try {
      await globalForBaileys.baileysSession.sock.readMessages(keys);
    } catch (e) {
      console.error("Failed to mark messages as read:", e);
    }
  }

  static async downloadMedia(msg: any) {
    if (!globalForBaileys.baileysSession.sock || !msg) return null;
    try {
      const buffer = await downloadMediaMessage(
        msg,
        "buffer",
        {},
        {
          logger: pino({ level: "silent" }) as any,
          reuploadRequest: globalForBaileys.baileysSession.sock.updateMediaMessage,
        }
      );
      return buffer as Buffer;
    } catch (e) {
      console.error("[Baileys] Error downloading media:", e);
      return null;
    }
  }

  static async sendProductCarousel(to: string, products: { title: string; price: string; image: string; link: string; id?: string }[]) {
    if (globalForBaileys.baileysSession.status !== "connected" || !globalForBaileys.baileysSession.sock) {
      throw new Error("WhatsApp not connected");
    }
    const jid = to.includes("@") ? to : `${to.replace(/[^\d+]/g, "")}@s.whatsapp.net`;
    
    // Construct the Carousel cards
    const cards = await Promise.all(products.map(async (p, index) => {
      // Buttons for each card
      const buttons = [
        {
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "View Product",
            url: p.link || "https://cutecoodle.com"
          })
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `Order ${p.title.substring(0, 10)}`,
            id: `order_${index}_${p.id || Date.now()}`
          })
        }
      ];

      let imageMessage;
      if (p.image && p.image !== "N/A") {
        try {
          const media = await prepareWAMessageMedia({ image: { url: p.image } }, { upload: globalForBaileys.baileysSession.sock.waUploadToServer });
          imageMessage = media.imageMessage;
        } catch (err) {
          console.error("[Baileys] Failed to prepare image for carousel card:", err);
        }
      }

      return {
        body: { text: `*${p.title}*\nPrice: ${p.price}` },
        header: {
          title: p.title,
          subtitle: p.price,
          hasMediaAttachment: !!imageMessage,
          ...(imageMessage && { imageMessage })
        },
        nativeFlowMessage: {
          buttons
        }
      };
    }));

    const interactiveMessage = {
      body: { text: "Here are some products that match what you're looking for! \nScroll right to see more ->" },
      footer: { text: "Powered by HazelWhat AI" },
      carouselMessage: {
        cards,
        messageVersion: 1
      }
    };

    const msg = generateWAMessageFromContent(
      jid,
      {
        viewOnceMessage: {
          message: {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2
            },
            interactiveMessage
          }
        }
      },
      { userJid: globalForBaileys.baileysSession.sock.user.id }
    );

    try {
      await globalForBaileys.baileysSession.sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
      return msg;
    } catch (e: any) {
      fs.writeFileSync('carousel_error.log', e.toString() + "\n" + e.stack);
      throw e;
    }
  }

  static async sendProductCard(to: string, product: { title: string; price: string; image: string; link: string; id?: string; description?: string }) {
    if (globalForBaileys.baileysSession.status !== "connected" || !globalForBaileys.baileysSession.sock) {
      throw new Error("WhatsApp not connected");
    }
    const jid = to.includes("@") ? to : `${to.replace(/[^\d+]/g, "")}@s.whatsapp.net`;
    
    let caption = `*${product.title}*`;
    if (product.price && product.price !== "N/A" && product.price !== "Hidden" && product.price !== "None") {
      caption += `\nPrice: ${product.price}`;
    }
    caption += `\n\n${product.description ? product.description + '\n\n' : ''}View Product: ${product.link || "https://cutecoodle.com"}`;
    
    if (product.image && product.image !== "N/A") {
      await globalForBaileys.baileysSession.sock.sendMessage(jid, { 
        image: { url: product.image }, 
        caption 
      });
    } else {
      await globalForBaileys.baileysSession.sock.sendMessage(jid, { text: caption });
    }
    
    // Explicitly save the product card to the database so it appears on the dashboard
    const fromStr = jid.replace("@s.whatsapp.net", "");
    DB.addChatMessage(fromStr, {
      role: "assistant",
      content: `[Product Card: ${product.title}]\nPrice: ${product.price}\nLink: ${product.link || "https://cutecoodle.com"}`
    });
  }
}

// Ensure intervals are hot-reloaded with the new logic in Next.js dev mode
if (globalForBaileys.baileysSession && globalForBaileys.baileysSession.status === "connected") {
  WhatsAppManager.startFollowUpsSync();
}
