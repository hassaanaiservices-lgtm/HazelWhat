import { makeWASocket, DisconnectReason, WAMessageStatus, downloadMediaMessage, generateWAMessageFromContent, prepareWAMessageMedia, fetchLatestBaileysVersion, Browsers, DEFAULT_CONNECTION_CONFIG, AuthenticationState } from "@whiskeysockets/baileys";
import { DB, DB_DIR, supabase } from "./db";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import pino from "pino";
import path from "path";
import fs from "fs";
import { useSupabaseAuthState } from "./whatsapp-auth";
import { scrapeStore } from "./scraper";

import { WhatsAppSessionRegistry } from "./whatsapp-session-registry";
import { getInstanceId } from "./instance-identity";

const AUTH_FOLDER = path.join(DB_DIR, ".baileys_auth");

export type SessionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'LOGGING_OUT' | 'FAILED';

export interface TenantSession {
  tenantId: string;
  status: SessionStatus;
  qrCode: string | null;
  qrGeneratedAt: number | null;
  sock: any | null;
  reconnectAttempts: number;
  reconnectTimeout: any | null;
  sessionConnectedAt: number | null;
  lastError: string | null;
  lastStatusCode: number | null;
  initLockPromise?: Promise<any> | null;
}

const globalForBaileys = global as unknown as {
  baileysSessions: Map<string, TenantSession>;
  autoSyncInterval: any;
  followUpInterval: any;
  revivalInterval: any;
  watchdogInterval: any;
  activeTenantId?: string | null;
  sessionConnectedAt?: number | null;
  baileysSession?: any; // legacy property
  reconnectAttempts?: number; // legacy property
  lastError?: string | null; // legacy property
  lastStatusCode?: number | null; // legacy property
};

if (!globalForBaileys.baileysSessions) {
  globalForBaileys.baileysSessions = new Map<string, TenantSession>();
}

if (globalForBaileys.sessionConnectedAt === undefined) {
  globalForBaileys.sessionConnectedAt = Date.now();
}

// Reconnect backoff with bounded exponential backoff and jitter
function getReconnectBackoff(attempts: number): number {
  const base = Math.min(30000, Math.pow(2, attempts) * 1000);
  const jitter = base * 0.2 * (Math.random() * 2 - 1);
  return Math.max(1000, Math.round(base + jitter));
}

// Graceful shutdown hook to release owned session leases and terminate sockets cleanly
if (typeof process !== "undefined") {
  const shutdown = async () => {
    console.log("[WhatsApp] Graceful shutdown: releasing session leases & closing active tenant sessions...");
    try {
      await WhatsAppSessionRegistry.releaseAllOwnedLeases();
    } catch (_) {}
    if (globalForBaileys.baileysSessions) {
      for (const [tenantId, session] of globalForBaileys.baileysSessions.entries()) {
        if (session.sock) {
          try {
            session.sock.end(undefined);
          } catch (_) {}
        }
      }
    }
  };
  process.on("SIGINT", async () => {
    await shutdown();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await shutdown();
    process.exit(0);
  });
}

// Preserve legacy globalForBaileys.baileysSession object using a dynamic proxy/getter
Object.defineProperty(globalForBaileys, "baileysSession", {
  get() {
    const tenantId = globalForBaileys.activeTenantId || "default";
    let session = globalForBaileys.baileysSessions.get(tenantId);
    if (!session) {
      session = {
        tenantId,
        status: "DISCONNECTED",
        qrCode: null,
        qrGeneratedAt: null,
        sock: null,
        reconnectAttempts: 0,
        reconnectTimeout: null,
        sessionConnectedAt: null,
        lastError: null,
        lastStatusCode: null,
      };
      globalForBaileys.baileysSessions.set(tenantId, session);
    }
    return {
      status: session.status.toLowerCase(),
      qrCode: session.qrCode,
      qrGeneratedAt: session.qrGeneratedAt,
      sock: session.sock,
    };
  },
  set(val) {
    const tenantId = globalForBaileys.activeTenantId || "default";
    let session = globalForBaileys.baileysSessions.get(tenantId);
    if (!session) {
      session = {
        tenantId,
        status: "DISCONNECTED",
        qrCode: null,
        qrGeneratedAt: null,
        sock: null,
        reconnectAttempts: 0,
        reconnectTimeout: null,
        sessionConnectedAt: null,
        lastError: null,
        lastStatusCode: null,
      };
      globalForBaileys.baileysSessions.set(tenantId, session);
    }
    if (val) {
      if (val.status) session.status = val.status.toUpperCase() as SessionStatus;
      if (val.qrCode !== undefined) session.qrCode = val.qrCode;
      if (val.qrGeneratedAt !== undefined) session.qrGeneratedAt = val.qrGeneratedAt;
      if (val.sock !== undefined) session.sock = val.sock;
    }
  },
  configurable: true,
  enumerable: true
});

export class WhatsAppManager {
  static setActiveTenantId(tenantId?: string | null) {
    if (tenantId) {
      globalForBaileys.activeTenantId = tenantId;
      console.log(`[WhatsAppManager] Active tenant set to: ${tenantId}`);
      if (supabase) {
        supabase.from('whatsapp_auth').upsert({
          tenant_id: 'default',
          key_id: 'active_tenant',
          key_data: { activeTenantId: tenantId }
        }, { onConflict: 'tenant_id,key_id' }).then(({ error }) => {
          if (error) console.error("[WhatsApp] Error persisting active tenant:", error);
          else console.log("[WhatsApp] Persisted active tenant to database:", tenantId);
        });
      }
    }
  }

  static getActiveTenantId(): string | null {
    return globalForBaileys.activeTenantId || null;
  }

  static getOrCreateSession(tenantId: string): TenantSession {
    let session = globalForBaileys.baileysSessions.get(tenantId);
    if (!session) {
      session = {
        tenantId,
        status: "DISCONNECTED",
        qrCode: null,
        qrGeneratedAt: null,
        sock: null,
        reconnectAttempts: 0,
        reconnectTimeout: null,
        sessionConnectedAt: null,
        lastError: null,
        lastStatusCode: null,
      };
      globalForBaileys.baileysSessions.set(tenantId, session);
    }
    return session;
  }

  static getTenantSession(tenantId: string): TenantSession {
    return this.getOrCreateSession(tenantId);
  }

  static getSessionStatus(tenantId: string): SessionStatus {
    return this.getOrCreateSession(tenantId).status;
  }

  static async resolveTenantForPhone(phone: string): Promise<string> {
    try {
      const cleanPhone = phone.replace(/[^\d]/g, "");
      const customer = await DB.getCustomer(cleanPhone);
      if (customer && customer.tenantId) {
        return customer.tenantId;
      }
    } catch (_) {}
    return this.getActiveTenantId() || "default";
  }

  static async resolveActiveTenantFromSocket(tenantId?: string): Promise<string | null> {
    try {
      const tId = tenantId || this.getActiveTenantId() || "default";
      const session = this.getOrCreateSession(tId);
      const sockUserId = session.sock?.user?.id;
      if (!sockUserId) {
        return null;
      }
      const cleanPhone = sockUserId.split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
      const tenants = await DB.getTenants();
      const matchedTenant = tenants.find(t => {
        const tPhone = (t.phoneNumber || "").replace(/[^0-9]/g, "");
        return tPhone && (tPhone === cleanPhone || cleanPhone.endsWith(tPhone) || tPhone.endsWith(cleanPhone));
      });
      if (matchedTenant) {
        globalForBaileys.activeTenantId = matchedTenant.id;
        console.log(`[WhatsApp] resolveActiveTenantFromSocket resolved connected phone for ${tId}: ${cleanPhone} -> ${matchedTenant.id}`);
        return matchedTenant.id;
      } else {
        console.log(`[WhatsApp] resolveActiveTenantFromSocket: No tenant matches connected phone number for ${tId}: ${cleanPhone}`);
        return null;
      }
    } catch (err) {
      console.error("[WhatsApp] Error in resolveActiveTenantFromSocket:", err);
      return null;
    }
  }

  static startAutoSync() {
    console.log("[Auto-Sync] Auto-Sync is disabled.");
  }

  static startFollowUpsSync() {
    if (process.env.DISABLE_LOCAL_WHATSAPP === 'true') {
      console.log("[WhatsApp] Follow-up sync skipped: DISABLE_LOCAL_WHATSAPP is true.");
      return;
    }
    if (globalForBaileys.followUpInterval) {
      clearInterval(globalForBaileys.followUpInterval);
    }
    globalForBaileys.followUpInterval = setInterval(async () => {
      try {
        const now = Date.now();
        const { generateContextualFollowUp, generateScheduledFollowUp } = await import('./ai-handler');
        
        // --- SYSTEM A: Proactive AI-Scheduled Follow-ups ---
        const pendingSystemAFollowUps = (await DB.getAllScheduledFollowUpsAdminAllTenants()).filter(f => f.status === 'pending');
        console.log(`[Follow-up Sync] pendingSystemAFollowUps count: ${pendingSystemAFollowUps.length}`);
        for (const fu of pendingSystemAFollowUps) {
          const sendAtMs = new Date(fu.sendAt).getTime();
          if (now >= sendAtMs) {
            console.log(`[System A Follow-up] Triggering scheduled follow-up for ${fu.phone}`);
            try {
              const aiMessage = await generateScheduledFollowUp(fu.phone, fu.context, fu.tenantId);
              const sentMsg = await this.sendMessage(fu.phone, aiMessage, fu.tenantId);
              await DB.addChatMessage(fu.phone, { id: sentMsg?.key?.id, role: "assistant", content: aiMessage }, fu.tenantId);
              await DB.updateFollowUpStatus(fu.id, "sent", fu.tenantId);
            } catch (err) {
              console.error(`[System A Follow-up] Failed to send to ${fu.phone}:`, err);
              await DB.updateFollowUpStatus(fu.id, "failed", fu.tenantId);
            }
          }
        }

        const stillPendingSystemA = (await DB.getAllScheduledFollowUpsAdminAllTenants()).filter(f => f.status === 'pending');
        const chats = await DB.getAllChatsAdminAllTenants();
        const orders = await DB.getOrdersAdminAllTenants();
        const pendingOrders = orders.filter(o => o.status === "pending");
        
        // --- SYSTEM C: Abandoned Order Recovery Engine ---
        for (const order of pendingOrders) {
          const phone = order.phone;
          const messages = chats[phone];
          if (!messages || messages.length === 0) continue;

          const session = this.getOrCreateSession(order.tenantId || "default");
          const sessionConnectedAt = session.sessionConnectedAt || Date.now();

          const userMessages = messages.filter(m => m.role === 'user');
          if (userMessages.length === 0) continue;
          const lastUserMessage = userMessages[userMessages.length - 1];
          if (new Date(lastUserMessage.timestamp).getTime() < sessionConnectedAt) {
            continue;
          }
          
          const lastMessage = messages[messages.length - 1];
          if (lastMessage.role !== 'assistant') continue;

          const elapsedMs = now - new Date(order.timestamp).getTime();
          const elapsedMinutes = elapsedMs / (1000 * 60);
          const currentStage = order.recoveryStage || 0;

          // Stage 1: 30 minutes
          if (currentStage < 1 && elapsedMinutes >= 30) {
            try {
              const template = `Hey! I noticed we got cut off while finalizing your order for the ${order.productName}. I've gone ahead and reserved one in our system for you. Where would you like me to ship it?`;
              const contextualMessage = await generateContextualFollowUp(phone, template, order.tenantId);
              const sentMsg = await this.sendMessage(phone, contextualMessage, order.tenantId);
              await DB.addChatMessage(phone, { id: sentMsg?.key?.id, role: "assistant", content: contextualMessage }, order.tenantId);
              await DB.updateOrder(order.id, { recoveryStage: 1 }, order.tenantId);
            } catch (err) {
              console.error(`[System C Stage 1] Failed for ${phone}:`, err);
            }
          }
          // Stage 2: 6 hours
          else if (currentStage < 2 && elapsedMinutes >= 360) {
            try {
              const template = `Hi! Just a quick heads-up: we have a lot of interest in the ${order.productName} today, and I can only hold your reservation for another hour before releasing it. Would you like to confirm your details to secure it?`;
              const contextualMessage = await generateContextualFollowUp(phone, template, order.tenantId);
              const sentMsg = await this.sendMessage(phone, contextualMessage, order.tenantId);
              await DB.addChatMessage(phone, { id: sentMsg?.key?.id, role: "assistant", content: contextualMessage }, order.tenantId);
              await DB.updateOrder(order.id, { recoveryStage: 2 }, order.tenantId);
            } catch (err) {
              console.error(`[System C Stage 2] Failed for ${phone}:`, err);
            }
          }
          // Stage 3: 24 hours
          else if (currentStage < 3 && elapsedMinutes >= 1440) {
            try {
              const template = `Hey! I really want to help you get this outfit. If we finalize your order for the ${order.productName} today, I can throw in free shipping. Let me know if you want me to add that in! 🎁`;
              const contextualMessage = await generateContextualFollowUp(phone, template, order.tenantId);
              const sentMsg = await this.sendMessage(phone, contextualMessage, order.tenantId);
              await DB.addChatMessage(phone, { id: sentMsg?.key?.id, role: "assistant", content: contextualMessage }, order.tenantId);
              await DB.updateOrder(order.id, { recoveryStage: 3 }, order.tenantId);
            } catch (err) {
              console.error(`[System C Stage 3] Failed for ${phone}:`, err);
            }
          }
          // Stage 4: 48 hours
          else if (currentStage < 4 && elapsedMinutes >= 2880) {
            try {
              const template = `Hi, since we haven't heard back, I've cancelled your pending order for the ${order.productName} and released the hold on the stock. If you decide to order it later, just send me a message here.`;
              const contextualMessage = await generateContextualFollowUp(phone, template, order.tenantId);
              const sentMsg = await this.sendMessage(phone, contextualMessage, order.tenantId);
              await DB.addChatMessage(phone, { id: sentMsg?.key?.id, role: "assistant", content: contextualMessage }, order.tenantId);
              await DB.updateOrder(order.id, { recoveryStage: 4, status: "cancelled" }, order.tenantId);
            } catch (err) {
              console.error(`[System C Stage 4] Failed for ${phone}:`, err);
            }
          }
        }

        // --- SYSTEM B: Generic Sequence Follow-ups ---
        const configCache: Record<string, any> = {};
        for (const phone in chats) {
          const messages = chats[phone] as any[];
          if (!messages || messages.length === 0) continue;

          const lastMessage = messages[messages.length - 1];
          if (!lastMessage || lastMessage.role !== 'assistant') continue;

          const elapsedMs = now - new Date(lastMessage.timestamp).getTime();
          if (elapsedMs < 2 * 60 * 1000) continue;

          const itemTenantId = messages[0]?.tenantId || messages[messages.length - 1]?.tenantId || "t-1007";
          const session = this.getOrCreateSession(itemTenantId);
          const sessionConnectedAt = session.sessionConnectedAt || Date.now();

          const userMessages = messages.filter(m => m.role === 'user');
          if (userMessages.length === 0) continue;
          const lastUserMessage = userMessages[userMessages.length - 1];
          if (new Date(lastUserMessage.timestamp).getTime() < sessionConnectedAt) continue;

          if (stillPendingSystemA.some(f => f.phone === phone)) continue;
          if (pendingOrders.some(o => o.phone === phone)) continue;

          if (!configCache[itemTenantId]) {
            configCache[itemTenantId] = await DB.getConfig(itemTenantId);
          }
          const tenantConfig = configCache[itemTenantId];
          if (!tenantConfig.followUps || tenantConfig.followUps.length === 0) continue;

          const customer = await DB.getCustomer(phone, itemTenantId);
          const followUpLevel = customer?.followUpLevel || 0;
          const nextFollowUp = tenantConfig.followUps[followUpLevel];

          const maxConfigured = tenantConfig.maxFollowUps !== undefined ? tenantConfig.maxFollowUps : (tenantConfig.followUps?.length || 7);
          const totalFollowUpLevels = Math.min(tenantConfig.followUps?.length || 7, maxConfigured);

          if (followUpLevel >= totalFollowUpLevels || !nextFollowUp || !nextFollowUp.enabled) {
            if (customer?.leadStatus !== "cold") await DB.updateCustomer(phone, { leadStatus: "cold" }, customer?.tenantId || itemTenantId);
            continue;
          }

          const requiredMs = nextFollowUp.delayMinutes * 60 * 1000;
          if (elapsedMs >= requiredMs) {
            try {
              const { shouldSendFollowUp } = await import('./ai-handler');
              const evaluation = await shouldSendFollowUp(phone, undefined, customer?.tenantId || itemTenantId);

              if (!evaluation.shouldFollowUp) {
                await DB.updateCustomer(phone, { leadStatus: "cold", pipelineStage: "completed" }, customer?.tenantId || itemTenantId);
                continue;
              }

              const contextualMessage = await generateContextualFollowUp(phone, nextFollowUp.message, customer?.tenantId || itemTenantId);
              const sentMsg = await this.sendMessage(phone, contextualMessage, customer?.tenantId || itemTenantId);
              await DB.addChatMessage(phone, { id: sentMsg?.key?.id, role: "assistant", content: contextualMessage }, customer?.tenantId || itemTenantId);
              await DB.updateCustomer(phone, { followUpLevel: followUpLevel + 1 }, customer?.tenantId || itemTenantId);
            } catch (err) {
              console.error(`[System B Follow-up] Error sending to ${phone}:`, err);
            }
          }
        }
      } catch (e) {
        console.error("[Follow-up Loop] Global Error during sync:", e);
      }
    }, 180000);
  }

  static startRevivalSync() {
    return;
  }

  static async processRevivalCampaign() {
    const campaigns = await DB.getRevivalCampaigns();
    const activeCampaigns = campaigns.filter(c => c.status === "active");
    if (activeCampaigns.length === 0) return;

    for (const campaign of activeCampaigns) {
      try {
        const delayMin = campaign.delayMinutes || 5;
        if (campaign.lastSentAt) {
          const lastSentTime = new Date(campaign.lastSentAt).getTime();
          const nextSendTime = lastSentTime + delayMin * 60 * 1000;
          if (Date.now() < nextSendTime) continue;
        }

        const session = this.getOrCreateSession(campaign.tenantId || "default");
        if (session.status !== "CONNECTED" || !session.sock) {
          continue;
        }

        const now = new Date();
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();
        const currentTimeMinutes = currentHour * 60 + currentMin;
        const slotStartMinutes = parseInt((campaign.timeSlotStart || "09:00").split(":")[0]) * 60 + parseInt((campaign.timeSlotStart || "09:00").split(":")[1] || "0");
        const slotEndMinutes = parseInt((campaign.timeSlotEnd || "21:00").split(":")[0]) * 60 + parseInt((campaign.timeSlotEnd || "21:00").split(":")[1] || "0");

        if (currentTimeMinutes < slotStartMinutes || currentTimeMinutes >= slotEndMinutes) {
          continue;
        }

        const today = now.toISOString().split("T")[0];
        let sentToday = campaign.sentToday || 0;
        if (campaign.lastSentDate !== today) {
          sentToday = 0;
          await DB.updateRevivalCampaign(campaign.id, { sentToday: 0, lastSentDate: today }, campaign.tenantId);
        }

        if (sentToday >= (campaign.dailyCap || 80)) continue;

        let progressMap: Record<string, any> = campaign.leadProgress || {};
        const sentSet = new Set([...(campaign.sentPhones || []), ...(campaign.failedPhones || [])]);
        const phase1Remaining = (campaign.targetPhones || []).filter(p => !sentSet.has(p));

        let targetPhone = "";
        let isPhase2FollowUp = false;

        if (phase1Remaining.length > 0) {
          targetPhone = phase1Remaining[0];
        } else if (campaign.phase2Settings && campaign.phase2Settings.enabled) {
          const intervalDays = campaign.phase2Settings.intervalDays || 3;
          const maxFollowUps = campaign.phase2Settings.maxFollowUps || 3;
          const intervalMs = intervalDays * 24 * 60 * 60 * 1000;

          for (const phone of (campaign.sentPhones || [])) {
            const customer = await DB.getCustomer(phone, campaign.tenantId);
            if (customer?.isOptedOut || (customer?.tags && customer.tags.includes("revival-replied"))) {
              continue;
            }

            const leadProg = progressMap[phone] || {
              phase: 1,
              followUpCount: 0,
              status: "phase1_done",
              introSentAt: campaign.lastSentAt || campaign.createdAt
            };

            if (leadProg.status === "replied" || leadProg.status === "opted_out" || leadProg.status === "completed") {
              continue;
            }

            if (leadProg.followUpCount < maxFollowUps) {
              const lastTouch = leadProg.nextRunAt ? new Date(leadProg.nextRunAt).getTime() : 
                (leadProg.introSentAt ? new Date(leadProg.introSentAt).getTime() : new Date(campaign.createdAt).getTime());
              
              if (Date.now() >= lastTouch + intervalMs) {
                targetPhone = phone;
                isPhase2FollowUp = true;
                break;
              }
            }
          }
        }

        if (!targetPhone) {
          const p2Enabled = campaign.phase2Settings?.enabled;
          if (!p2Enabled) {
            await DB.updateRevivalCampaign(campaign.id, { status: "completed" }, campaign.tenantId);
          } else {
            const maxFollowUps = campaign.phase2Settings?.maxFollowUps || 3;
            let allCompleted = true;
            for (const phone of (campaign.sentPhones || [])) {
              const customer = await DB.getCustomer(phone, campaign.tenantId);
              if (customer?.isOptedOut || (customer?.tags && customer.tags.includes("revival-replied"))) {
                continue;
              }
              const leadProg = progressMap[phone];
              const count = leadProg?.followUpCount || 0;
              const status = leadProg?.status;
              const isFinished = status === "completed" || status === "replied" || status === "opted_out" || count >= maxFollowUps;
              if (!isFinished) {
                allCompleted = false;
                break;
              }
            }
            if (allCompleted) {
              await DB.updateRevivalCampaign(campaign.id, { status: "completed" }, campaign.tenantId);
            }
          }
          continue;
        }

        let sentSuccess = false;
        const currentSentPhones = [...(campaign.sentPhones || [])];
        const currentFailedPhones = [...(campaign.failedPhones || [])];

        try {
          if (!isPhase2FollowUp) {
            if (campaign.messageType === "voice" && campaign.voiceBase64) {
              const buffer = Buffer.from(campaign.voiceBase64.split(",")[1] || campaign.voiceBase64, "base64");
              await this.sendMedia(targetPhone, buffer, campaign.voiceMimetype || "audio/mp4", "voice_note.mp4", "", true, campaign.tenantId);
            } else if (campaign.mediaBase64 && campaign.mimetype) {
              const buffer = Buffer.from(campaign.mediaBase64.split(",")[1] || campaign.mediaBase64, "base64");
              await this.sendMedia(targetPhone, buffer, campaign.mimetype, campaign.fileName || "document", campaign.message, false, campaign.tenantId);
            } else {
              await this.sendMessage(targetPhone, campaign.message || "Hello! We miss you!", campaign.tenantId);
            }

            await DB.addChatMessage(targetPhone, {
              id: "rv1-" + Math.random().toString(36).substring(2, 8),
              role: "assistant",
              content: campaign.message || (campaign.messageType === "voice" ? "[Voice Note]" : "[Media]"),
              status: 1,
            }, campaign.tenantId);

            const customer = await DB.getCustomer(targetPhone, campaign.tenantId);
            const existingTags = customer?.tags || [];
            if (!existingTags.includes("revival-sent")) {
              await DB.updateCustomer(targetPhone, { tags: [...existingTags, "revival-sent"] }, campaign.tenantId);
            }

            progressMap[targetPhone] = {
              phase: 1,
              introSentAt: new Date().toISOString(),
              followUpCount: 0,
              status: "phase1_done",
              lastMessageType: campaign.messageType || (campaign.mediaBase64 ? "media" : "text")
            };

            if (!currentSentPhones.includes(targetPhone)) {
              currentSentPhones.push(targetPhone);
            }
            sentSuccess = true;
          } else {
            const p2 = campaign.phase2Settings!;
            const currentCount = (progressMap[targetPhone]?.followUpCount || 0) + 1;
            
            let msgType = p2.mode;
            if (p2.mode === "mixed") {
              const types: ("text" | "media" | "voice")[] = ["text", "media", "voice"];
              msgType = types[Math.floor(Math.random() * types.length)];
            }

            let followUpText = (p2.messages && p2.messages[currentCount - 1]) || p2.messages?.[0] || "Hi there, just following up on our previous message!";

            if (msgType === "voice" && p2.voiceBase64) {
              const buffer = Buffer.from(p2.voiceBase64.split(",")[1] || p2.voiceBase64, "base64");
              await this.sendMedia(targetPhone, buffer, p2.voiceMimetype || "audio/mp4", "followup_voice.mp4", "", true, campaign.tenantId);
            } else if (msgType === "media" && p2.mediaBase64) {
              const buffer = Buffer.from(p2.mediaBase64.split(",")[1] || p2.mediaBase64, "base64");
              await this.sendMedia(targetPhone, buffer, p2.mediaMimetype || "image/jpeg", "followup_media", followUpText, false, campaign.tenantId);
            } else {
              await this.sendMessage(targetPhone, followUpText, campaign.tenantId);
            }

            await DB.addChatMessage(targetPhone, {
              id: "rv2-" + Math.random().toString(36).substring(2, 8),
              role: "assistant",
              content: followUpText || `[Follow-up ${currentCount}]`,
              status: 1,
            }, campaign.tenantId);

            const isFinal = currentCount >= p2.maxFollowUps;
            progressMap[targetPhone] = {
              ...progressMap[targetPhone],
              phase: 2,
              followUpCount: currentCount,
              nextRunAt: new Date().toISOString(),
              status: isFinal ? "completed" : "in_followup",
              lastMessageType: msgType as any
            };
            sentSuccess = true;
          }
        } catch (err: any) {
          console.error(`[Revival] Error sending to ${targetPhone}:`, err);
          if (!isPhase2FollowUp && !currentFailedPhones.includes(targetPhone)) {
            currentFailedPhones.push(targetPhone);
          }
        }

        const updatedSentToday = sentToday + (sentSuccess ? 1 : 0);

        await DB.updateRevivalCampaign(campaign.id, {
          sentPhones: currentSentPhones,
          failedPhones: currentFailedPhones,
          sentToday: updatedSentToday,
          lastSentDate: today,
          lastSentAt: new Date().toISOString(),
          leadProgress: progressMap,
        }, campaign.tenantId);
      } catch (e) {
        console.error(`[Revival] Campaign loop error for ${campaign.id}:`, e);
      }
    }
  }

  static startSessionWatchdog() {
    if (process.env.DISABLE_LOCAL_WHATSAPP === 'true') {
      console.log("[WhatsApp] Session watchdog skipped: DISABLE_LOCAL_WHATSAPP is true.");
      return;
    }
    if (globalForBaileys.watchdogInterval) {
      clearInterval(globalForBaileys.watchdogInterval);
    }
    globalForBaileys.watchdogInterval = setInterval(async () => {
      try {
        if (!globalForBaileys.baileysSessions) return;
        for (const [tenantId, session] of globalForBaileys.baileysSessions.entries()) {
          const hasSupabaseCreds = await DB.hasSavedCredentials(tenantId);
          const localCredsFile = path.join(DB_DIR, `.baileys_auth_${tenantId}`, "creds.json");
          const hasLocalCreds = fs.existsSync(localCredsFile);
          const hasSavedCreds = hasLocalCreds || hasSupabaseCreds;

          if (hasSavedCreds && (session.status === "DISCONNECTED" || !session.sock) && !session.initLockPromise) {
            console.log(`[Watchdog] Reconnecting active session for tenant ${tenantId}...`);
            const { handleWhatsAppMessage } = await import("./ai-handler");
            this.connectTenant(tenantId, async (msg) => {
              await handleWhatsAppMessage(msg);
            }).catch((err) => {
              console.error(`[Watchdog] Auto-heal reconnection failed for ${tenantId}:`, err);
            });
          }
        }
      } catch (e) {
        console.error("[Watchdog] Error during health check:", e);
      }
    }, 30000);
  }

  static async ensureConnected(tenantId?: string) {
    const tId = tenantId || this.getActiveTenantId() || "default";
    const session = this.getOrCreateSession(tId);
    if (session.status === "CONNECTED" && session.sock) {
      return session.sock;
    }

    const hasSupabaseCreds = await DB.hasSavedCredentials(tId);
    const localCredsFile = path.join(DB_DIR, `.baileys_auth_${tId}`, "creds.json");
    const hasLocalCreds = fs.existsSync(localCredsFile);
    const hasSavedCreds = hasLocalCreds || hasSupabaseCreds;

    if (hasSavedCreds) {
      console.log(`[Baileys] Socket not connected for tenant ${tId}. Auto-reconnecting...`);
      const { handleWhatsAppMessage } = await import("./ai-handler");
      await this.connectTenant(tId, async (msg) => {
        await handleWhatsAppMessage(msg);
      });
      if (session.status === "CONNECTED" && session.sock) {
        return session.sock;
      }
    }

    throw new Error(`WhatsApp not connected for tenant ${tId}. Please connect WhatsApp.`);
  }

  static async startSession(onMessage: (msg: any) => void, tenantId?: string) {
    if (!globalForBaileys.autoSyncInterval) {
      this.startAutoSync();
    }
    if (!globalForBaileys.followUpInterval) {
      this.startFollowUpsSync();
    }
    if (!globalForBaileys.revivalInterval) {
      this.startRevivalSync();
    }
    if (!globalForBaileys.watchdogInterval) {
      this.startSessionWatchdog();
    }

    const tId = tenantId || this.getActiveTenantId() || "default";
    return this.connectTenant(tId, onMessage);
  }

  static async connectTenant(tenantId: string, onMessage?: (msg: any) => void) {
    const session = this.getOrCreateSession(tenantId);

    if (session.initLockPromise) {
      console.log(`[WhatsApp] Connection initialization already in progress for tenant ${tenantId}.`);
      return session.initLockPromise;
    }

    if (session.status === "CONNECTED" && session.sock) {
      return session.sock;
    }

    // Phase 6B: Acquire distributed lease ownership before creating socket
    const lease = await WhatsAppSessionRegistry.acquireLease(tenantId, () => {
      console.warn(`[WhatsApp] Ownership lease lost for tenant ${tenantId}! Shutting down active socket on instance ${getInstanceId()}...`);
      const s = WhatsAppManager.getOrCreateSession(tenantId);
      s.status = "DISCONNECTED";
      if (s.sock) {
        try { s.sock.end(undefined); } catch (_) {}
        s.sock = null;
      }
    });

    if (!lease.acquired) {
      console.log(`[WhatsApp] Tenant ${tenantId} session is owned by another instance (${lease.reason}). Skipping local socket creation on instance ${getInstanceId()}.`);
      session.status = "DISCONNECTED";
      return null;
    }

    session.status = "CONNECTING";

    const initPromise = (async () => {
      const { state, saveCreds } = await useSupabaseAuthState(tenantId);
      const logger = pino({ level: "silent" });

      let version = DEFAULT_CONNECTION_CONFIG.version;
      try {
        const latestPromise = fetchLatestBaileysVersion();
        const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000));
        const latest = await Promise.race([latestPromise, timeoutPromise]) as { version: [number, number, number], isLatest: boolean };
        if (latest?.version) {
          version = latest.version;
        }
        console.log(`[Baileys] Successfully fetched latest WA version for ${tenantId}: v${version.join('.')}`);
      } catch (err) {
        console.warn(`[Baileys] Failed to fetch latest WA version for ${tenantId}, using default:`, err);
      }

      if (session.sock) {
        try {
          session.sock.ev.removeAllListeners("connection.update");
          session.sock.ev.removeAllListeners("creds.update");
          session.sock.ev.removeAllListeners("messages.upsert");
          session.sock.end(undefined);
        } catch (e) {}
      }

      const sock = makeWASocket({
        version,
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: Browsers.macOS("Chrome"),
        syncFullHistory: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        retryRequestOptions: {
          maxRetries: 5
        }
      });

      session.sock = sock;

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const qrCodeDataUri = await QRCode.toDataURL(qr, { errorCorrectionLevel: 'M', margin: 2, width: 512 });
            console.log(`[Baileys] New QR code generated for ${tenantId}`);
            session.status = "CONNECTING";
            session.qrCode = qrCodeDataUri;
            session.qrGeneratedAt = Date.now();
          } catch (err) {
            console.error(`[Baileys] Error generating QR for ${tenantId}:`, err);
          }
        }

        if (connection === "open") {
          console.log(`[WhatsApp] Connected successfully for tenant ${tenantId}`);
          session.status = "CONNECTED";
          session.qrCode = null;
          session.reconnectAttempts = 0;
          if (session.reconnectTimeout) {
            clearTimeout(session.reconnectTimeout);
            session.reconnectTimeout = null;
          }
          await WhatsAppSessionRegistry.updateStatus(tenantId, "CONNECTED", "active");
        }

        if (connection === "close") {
          console.log(`[WhatsApp] Connection closed for tenant ${tenantId}`);
          
          if (session.status === "LOGGING_OUT" || session.status === "DISCONNECTED") {
            console.log(`[Baileys] Socket closed for ${tenantId} after explicit disconnect.`);
            if (session.sock === sock) {
              session.sock = null;
            }
            try {
              sock.ev.removeAllListeners("connection.update");
              sock.ev.removeAllListeners("creds.update");
              sock.ev.removeAllListeners("messages.upsert");
              sock.end(undefined);
            } catch (e) {}
            return;
          }

          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const errorMsg = lastDisconnect?.error?.message || "";
          
          session.lastStatusCode = statusCode || null;
          session.lastError = errorMsg || null;
          
          console.log(`[Baileys] Connection closed for tenant ${tenantId}. Status code: ${statusCode || 'unknown'}. Error: ${errorMsg}`);
          
          if (session.sock === sock) {
            session.sock = null;
          }
          try {
            sock.ev.removeAllListeners("connection.update");
            sock.ev.removeAllListeners("creds.update");
            sock.ev.removeAllListeners("messages.upsert");
            sock.end(undefined);
          } catch (e) {}

          // Handle explicit logout immediately to avoid retrying with invalid credentials
          if (statusCode === DisconnectReason.loggedOut) {
            console.log(`[WhatsApp] Connection state: FAILED (explicit logout from phone) for ${tenantId}. Clearing credentials.`);
            session.status = "FAILED";
            session.qrCode = null;
            session.reconnectAttempts = 0;
            if (session.reconnectTimeout) {
              clearTimeout(session.reconnectTimeout);
              session.reconnectTimeout = null;
            }
            try {
              const { useSupabaseAuthState } = await import("./whatsapp-auth");
              const { removeCreds } = await useSupabaseAuthState(tenantId);
              await removeCreds();
            } catch (e) {}
            return;
          }

          // Critical QR pairing fix: Status 515 (Restart Required) happens immediately after scanning QR.
          // Reconnect IMMEDIATELY (0ms) so WhatsApp server pairing handshake does not expire!
          const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;
          if (isRestartRequired) {
            console.log(`[WhatsApp] Instant socket restart requested (515) for ${tenantId}. Reconnecting immediately...`);
            session.reconnectAttempts = 0;
            if (session.reconnectTimeout) {
              clearTimeout(session.reconnectTimeout);
              session.reconnectTimeout = null;
            }
            this.connectTenant(tenantId, onMessage).catch(err => {
              console.error(`[WhatsApp] 515 immediate reconnect error for ${tenantId}:`, err);
            });
            return;
          }

          // Phase 6B: Verify ownership BEFORE attempting normal reconnect backoff
          const stillOwner = await WhatsAppSessionRegistry.isOwner(tenantId);
          if (!stillOwner) {
            console.log(`[WhatsApp] Reconnection cancelled for ${tenantId}: instance ${getInstanceId()} no longer holds session lease.`);
            session.status = "DISCONNECTED";
            session.sock = null;
            return;
          }

          const localCredsFile = path.join(DB_DIR, `.baileys_auth_${tenantId}`, "creds.json");
          const hasLocalCreds = fs.existsSync(localCredsFile);
          const hasSupabaseCreds = await DB.hasSavedCredentials(tenantId);
          const hasCreds = hasLocalCreds || hasSupabaseCreds;

          if (hasCreds || session.qrCode) {
            const currentAttempts = (session.reconnectAttempts || 0) + 1;
            session.reconnectAttempts = currentAttempts;

            session.status = "RECONNECTING";

            if (!session.reconnectTimeout) {
              const backoffMs = getReconnectBackoff(currentAttempts);
              console.log(`[WhatsApp] Reconnecting tenant ${tenantId} in ${backoffMs / 1000}s (attempt #${currentAttempts})`);

              session.reconnectTimeout = setTimeout(() => {
                session.reconnectTimeout = null;
                this.connectTenant(tenantId, onMessage).catch(err => {
                  console.error(`[WhatsApp] Reconnection failed for tenant ${tenantId}:`, err);
                });
              }, backoffMs);
            }
          } else {
            console.log(`[WhatsApp] Disconnected tenant ${tenantId} (no credentials).`);
            session.status = "DISCONNECTED";
            session.qrCode = null;
            session.reconnectAttempts = 0;
          }
        } else if (connection === "open") {
          console.log(`[WhatsApp] Connected successfully for tenant ${tenantId}!`);
          session.status = "CONNECTED";
          session.qrCode = null;
          session.reconnectAttempts = 0;
          if (session.reconnectTimeout) {
            clearTimeout(session.reconnectTimeout);
            session.reconnectTimeout = null;
          }
          session.sessionConnectedAt = Date.now();

          await WhatsAppSessionRegistry.updateStatus(tenantId, "CONNECTED", "active");

          WhatsAppManager.resolveActiveTenantFromSocket(tenantId).catch(err => {
            console.error(`[WhatsApp] Error resolving active tenant on connection open for ${tenantId}:`, err);
          });
        }
      });

      sock.ev.on("messages.upsert", async (m) => {
        if (m.type === "notify") {
          for (const msg of m.messages) {
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid || remoteJid === "status@broadcast" || remoteJid.endsWith("@newsletter")) {
              continue;
            }
            if (!msg.key.fromMe && msg.message) {
              if (onMessage) {
                onMessage(msg);
              } else {
                const { handleWhatsAppMessage } = await import("./ai-handler");
                await handleWhatsAppMessage(msg, tenantId);
              }
            } else if (msg.key.fromMe && msg.message) {
              const textContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "";
              const hasImage = !!msg.message?.imageMessage;
              const isSticker = !!msg.message?.stickerMessage;
              const content = isSticker ? "[Sticker]" : hasImage ? `[Image] ${textContent}` : textContent;
              
              if (content) {
                let from = msg.key.remoteJid;
                const originalJid = msg.key.remoteJid;
                if (from?.includes("@lid") && msg.key.remoteJidAlt) {
                  from = msg.key.remoteJidAlt;
                }
                from = from?.replace("@s.whatsapp.net", "")?.replace("@lid", "");
                
                if (from) {
                  if (originalJid) {
                    await DB.updateCustomer(from, { jid: originalJid }, tenantId);
                  }
                  const history = await DB.getChats(from);
                  const exists = history.some((chatMsg: any) => chatMsg.id === msg.key.id);
                  if (!exists) {
                    await DB.addChatMessage(from, { id: msg.key.id || undefined, role: "assistant", content }, tenantId);
                  }
                }
              }
            }
          }
        }
      });

      sock.ev.on("messages.update", async (updates) => {
        for (const { key, update } of updates) {
          if (key.id && update.status) {
            await DB.updateMessageStatus(key.id, update.status);
          }
        }
      });

      sock.ev.on("messaging-history.set", async ({ contacts, messages }) => {
        for (const contact of contacts) {
          if (contact.id && contact.id !== "status@broadcast" && !contact.id.endsWith("@newsletter")) {
            const phone = contact.id.replace("@s.whatsapp.net", "").replace("@lid", "");
            if (phone) {
              const isGroup = contact.id.endsWith("@g.us");
              await DB.updateCustomer(phone, { 
                name: contact.name || contact.notify || (isGroup ? `Group: ${phone.split('@')[0]}` : phone),
                jid: contact.id
              }, tenantId);
            }
          }
        }

        if (messages) {
          for (const msg of messages) {
            const remoteJid = msg.key.remoteJid;
            if (remoteJid && remoteJid !== "status@broadcast" && !remoteJid.endsWith("@newsletter")) {
              const textContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "";
              const isSticker = !!msg.message?.stickerMessage;
              const hasImage = !!msg.message?.imageMessage;
              const content = isSticker ? "[Sticker]" : hasImage ? `[Image] ${textContent}` : textContent;
              if (content) {
                let from = msg.key.remoteJid;
                const originalJid = msg.key.remoteJid;
                if (from?.includes("@lid")) {
                  if (msg.key.remoteJidAlt) {
                    from = msg.key.remoteJidAlt;
                  } else {
                    continue;
                  }
                }
                from = from?.replace("@s.whatsapp.net", "");
                
                if (from) {
                  if (originalJid) {
                    await DB.updateCustomer(from, { jid: originalJid }, tenantId);
                  }
                  const history = await DB.getChats(from);
                  const exists = history.some((chatMsg: any) => chatMsg.id === msg.key.id);
                  if (!exists) {
                    const timestampStr = msg.messageTimestamp 
                      ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
                      : new Date().toISOString();
                      
                    await DB.addChatMessage(from, { 
                      id: msg.key.id || undefined, 
                      role: msg.key.fromMe ? "assistant" : "user", 
                      content,
                      timestamp: timestampStr
                    }, tenantId);
                  }
                }
              }
            }
          }
        }
      });

      sock.ev.on("contacts.upsert", async (contacts) => {
        for (const contact of contacts) {
          if (contact.id && contact.id !== "status@broadcast" && !contact.id.endsWith("@newsletter")) {
            const phone = contact.id.replace("@s.whatsapp.net", "").replace("@lid", "");
            if (phone) {
              const isGroup = contact.id.endsWith("@g.us");
              await DB.updateCustomer(phone, { 
                name: contact.name || contact.notify || (isGroup ? `Group: ${phone.split('@')[0]}` : phone),
                jid: contact.id
              }, tenantId);
            }
          }
        }
      });

      return sock;
    })();

    session.initLockPromise = initPromise;
    try {
      const sock = await initPromise;
      return sock;
    } finally {
      session.initLockPromise = null;
    }
  }

  static getStatus(tenantId?: string) {
    const tId = tenantId || this.getActiveTenantId() || "default";
    const session = this.getOrCreateSession(tId);
    return {
      status: session.status.toLowerCase(),
      qrCode: session.qrCode,
      qrGeneratedAt: session.qrGeneratedAt,
      phoneNumber: session.sock?.user?.id?.split(":")[0],
      displayName: session.sock?.user?.name || "WhatsApp Business",
      lastError: session.lastError || null,
      lastStatusCode: session.lastStatusCode || null,
      reconnectAttempts: session.reconnectAttempts || 0,
    };
  }

  static getAllSessions() {
    if (!globalForBaileys.baileysSessions) return [];
    return Array.from(globalForBaileys.baileysSessions.entries()).map(([tenantId, session]) => ({
      tenantId,
      status: session.status.toLowerCase(),
      phoneNumber: session.sock?.user?.id?.split(":")[0] || null,
      displayName: session.sock?.user?.name || "WhatsApp Business",
    }));
  }

  static async requestPairingCode(phoneNumber: string, tenantId?: string): Promise<string> {
    const tId = tenantId || this.getActiveTenantId() || "default";
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (!cleanPhone) {
      throw new Error("Invalid phone number format. Please enter full phone number with country code.");
    }

    const session = this.getOrCreateSession(tId);
    if (!session.sock) {
      await this.connectTenant(tId, async () => {});
    }

    const sock = session.sock;
    if (!sock) {
      throw new Error("WhatsApp connection socket is not ready.");
    }

    const rawCode = await sock.requestPairingCode(cleanPhone);
    return rawCode?.match(/.{1,4}/g)?.join('-') || rawCode;
  }

  static async disconnectTenant(tenantId: string) {
    // Release distributed session lease
    await WhatsAppSessionRegistry.releaseLease(tenantId);

    const session = this.getOrCreateSession(tenantId);
    if (session.reconnectTimeout) {
      clearTimeout(session.reconnectTimeout);
      session.reconnectTimeout = null;
    }

    session.status = "DISCONNECTED";

    if (session.sock) {
      try {
        session.sock.logout();
      } catch (e) {}
      try {
        session.sock.end(undefined);
      } catch (e) {}
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    session.sock = null;
    session.qrCode = null;
    session.reconnectAttempts = 0;
    
    const localDir = path.join(DB_DIR, `.baileys_auth_${tenantId}`);
    if (fs.existsSync(localDir)) {
      try {
        fs.rmSync(localDir, { recursive: true, force: true });
      } catch (e) {
        console.error("Failed to delete auth folder:", e);
      }
    }

    try {
      const { useSupabaseAuthState } = await import("./whatsapp-auth");
      const { removeCreds } = await useSupabaseAuthState(tenantId);
      await removeCreds();
      console.log(`[Baileys] Supabase credentials cleared for tenant ${tenantId}.`);
    } catch (e) {
      console.error("[Baileys] Failed to clear Supabase credentials:", e);
    }
  }

  static async reconnectTenant(tenantId: string) {
    const session = this.getOrCreateSession(tenantId);
    if (session.reconnectTimeout) {
      clearTimeout(session.reconnectTimeout);
      session.reconnectTimeout = null;
    }

    session.status = "RECONNECTING";

    if (session.sock) {
      try {
        session.sock.end(undefined);
      } catch (e) {}
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    session.sock = null;
    
    const { handleWhatsAppMessage } = await import("./ai-handler");
    return this.connectTenant(tenantId, async (msg) => {
      await handleWhatsAppMessage(msg);
    });
  }

  static async softReset() {
    const activeTenantId = this.getActiveTenantId() || "default";
    return this.reconnectTenant(activeTenantId);
  }

  static async disconnect() {
    const activeTenantId = this.getActiveTenantId() || "default";
    return this.disconnectTenant(activeTenantId);
  }

  static async resolveJid(to: string, tenantId?: string): Promise<string> {
    if (to.includes("@")) {
      return to;
    }
    let cleanPhone = to.replace(/[^\d]/g, "");
    
    if (cleanPhone.startsWith("0") && !cleanPhone.startsWith("00")) {
      const tId = tenantId || await this.resolveTenantForPhone(to);
      const session = this.getOrCreateSession(tId);
      const ownJid = session.sock?.user?.id;
      let countryCode = "92";
      if (ownJid) {
        const ownNumber = ownJid.split("@")[0].split(":")[0];
        if (ownNumber.length > 10) {
          countryCode = ownNumber.substring(0, ownNumber.length - 10);
        }
      }
      cleanPhone = countryCode + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith("00")) {
      cleanPhone = cleanPhone.substring(2);
    }

    const tId = tenantId || await this.resolveTenantForPhone(to);
    const customer = await DB.getCustomer(cleanPhone, tId);
    if (customer && customer.jid) {
      return customer.jid;
    }
    return `${cleanPhone}@s.whatsapp.net`;
  }

  static async sendTyping(to: string, tenantId?: string) {
    const tId = tenantId || await this.resolveTenantForPhone(to);
    const session = this.getOrCreateSession(tId);
    if (session.status !== "CONNECTED" || !session.sock) return;
    const jid = await this.resolveJid(to, tId);
    await session.sock.sendPresenceUpdate('composing', jid);
  }

  static async sendMessage(to: string, text: string, tenantId?: string) {
    try {
      const tId = tenantId || await this.resolveTenantForPhone(to);
      const sock = await this.ensureConnected(tId);
      const jid = await this.resolveJid(to, tId);
      await sock.sendPresenceUpdate('paused', jid);
      const sentMsg = await sock.sendMessage(jid, { text });
      return sentMsg;
    } catch (err: any) {
      if (err?.message?.includes("WhatsApp not connected")) {
        console.warn(`[WhatsApp] Socket not connected — skipping outgoing message send to ${to}`);
        return null;
      }
      throw err;
    }
  }

  static async sendImageUrl(to: string, imageUrl: string, caption?: string, tenantId?: string) {
    const tId = tenantId || await this.resolveTenantForPhone(to);
    const sock = await this.ensureConnected(tId);
    const jid = await this.resolveJid(to, tId);
    await sock.sendPresenceUpdate('paused', jid);
    const sentMsg = await sock.sendMessage(jid, { image: { url: imageUrl }, caption: caption || "" });
    return sentMsg;
  }

  static async sendMedia(to: string, buffer: Buffer, mimetype: string, fileName?: string, caption?: string, isVoiceNote = false, tenantId?: string) {
    const tId = tenantId || await this.resolveTenantForPhone(to);
    const sock = await this.ensureConnected(tId);
    const jid = await this.resolveJid(to, tId);
    
    let msgObj: any = {};
    if (isVoiceNote || mimetype.startsWith('audio/')) {
        await sock.sendPresenceUpdate('recording', jid);
        msgObj = { audio: buffer, ptt: isVoiceNote, mimetype: mimetype || 'audio/mp4' };
    } else if (mimetype.startsWith('image/')) {
        await sock.sendPresenceUpdate('paused', jid);
        msgObj = { image: buffer, caption: caption || fileName };
    } else if (mimetype.startsWith('video/')) {
        await sock.sendPresenceUpdate('paused', jid);
        msgObj = { video: buffer, caption: caption || fileName };
    } else {
        await sock.sendPresenceUpdate('paused', jid);
        msgObj = { document: buffer, mimetype, fileName: fileName || "document", caption: caption };
    }
    const sentMsg = await sock.sendMessage(jid, msgObj);
    return sentMsg;
  }

  static async markChatRead(phone: string, messageIds: string[], tenantId?: string) {
    const tId = tenantId || await this.resolveTenantForPhone(phone);
    const session = this.getOrCreateSession(tId);
    if (session.status !== "CONNECTED" || !session.sock || !messageIds.length) return;
    const jid = await this.resolveJid(phone, tId);
    const keys = messageIds.map(id => ({ remoteJid: jid, id, fromMe: false }));
    try {
      await session.sock.readMessages(keys);
    } catch (e) {
      console.error("[Baileys] Failed to mark messages read:", e);
    }
  }

  static async downloadMedia(msg: any, tenantId?: string) {
    const tId = tenantId || this.getActiveTenantId() || "default";
    const session = this.getOrCreateSession(tId);
    if (!session.sock || !msg) return null;
    try {
      const buffer = await downloadMediaMessage(
        msg,
        "buffer",
        {},
        {
          logger: pino({ level: "silent" }) as any,
          reuploadRequest: session.sock.updateMediaMessage,
        }
      );
      return buffer as Buffer;
    } catch (e) {
      console.error("[Baileys] Error downloading media:", e);
      return null;
    }
  }

  static async sendProductCarousel(to: string, products: { title: string; price: string; image: string; link: string; id?: string }[], tenantId?: string) {
    const tId = tenantId || await this.resolveTenantForPhone(to);
    const session = this.getOrCreateSession(tId);
    if (session.status !== "CONNECTED" || !session.sock) {
      throw new Error("WhatsApp not connected");
    }
    const jid = await this.resolveJid(to, tId);
    
    const cards = await Promise.all(products.map(async (p, index) => {
      const buttons = [
        {
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "View Product",
            url: p.link || "#"
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
          const media = await prepareWAMessageMedia({ image: { url: p.image } }, { upload: session.sock.waUploadToServer });
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
      { userJid: session.sock.user.id }
    );

    try {
      await session.sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
      return msg;
    } catch (e: any) {
      fs.writeFileSync('carousel_error.log', e.toString() + "\n" + e.stack);
      throw e;
    }
  }

  static async sendProductCard(to: string, product: { title: string; price: string; image: string; link: string; id?: string; description?: string }, tenantId?: string) {
    const tId = tenantId || await this.resolveTenantForPhone(to);
    const session = this.getOrCreateSession(tId);
    if (session.status !== "CONNECTED" || !session.sock) {
      throw new Error("WhatsApp not connected");
    }
    const jid = await this.resolveJid(to, tId);
    
    let caption = `*${product.title}*`;
    if (product.price && product.price !== "N/A" && product.price !== "Hidden" && product.price !== "None") {
      caption += `\nPrice: ${product.price}`;
    }
    if (product.description) {
      caption += `\n\n${product.description}`;
    }
    const isValidUrl = (url?: string) => {
      if (!url || typeof url !== 'string') return false;
      const clean = url.trim();
      return (clean.startsWith('http://') || clean.startsWith('https://')) && 
             !clean.includes('example.com') && 
             !clean.includes('placeholder') && 
             clean !== 'N/A' && 
             clean.trim() !== '';
    };

    if (product.link && isValidUrl(product.link)) {
      caption += `\n\nView Product: ${product.link}`;
    }

    if (isValidUrl(product.image)) {
      try {
        await session.sock.sendMessage(jid, { 
          image: { url: product.image.trim() }, 
          caption 
        });
      } catch (e) {
        console.warn("[sendProductCard] Failed to send image, falling back to clean text card:", e);
        await session.sock.sendMessage(jid, { text: caption });
      }
    } else {
      await session.sock.sendMessage(jid, { text: caption });
    }
    
    const fromStr = jid.replace("@s.whatsapp.net", "");
    await DB.addChatMessage(fromStr, {
      role: "assistant",
      content: `[Product Card: ${product.title}]\nPrice: ${product.price}${product.link ? '\nLink: ' + product.link : ''}`
    }, tId);
  }
}

// Automatically start followups, revival and watchdog
WhatsAppManager.startFollowUpsSync();
WhatsAppManager.startRevivalSync();
WhatsAppManager.startSessionWatchdog();
