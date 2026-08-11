import { makeWASocket, DisconnectReason, WAMessageStatus, downloadMediaMessage, generateWAMessageFromContent, prepareWAMessageMedia, fetchLatestBaileysVersion, Browsers, DEFAULT_CONNECTION_CONFIG } from "@whiskeysockets/baileys";
import { DB, DB_DIR, supabase } from "./db";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import pino from "pino";
import path from "path";
import fs from "fs";
import { useSupabaseAuthState } from "./whatsapp-auth";
import { scrapeStore } from "./scraper";
const AUTH_FOLDER = path.join(DB_DIR, ".baileys_auth");

const globalForBaileys = global as unknown as {
  baileysSession: any;
  autoSyncInterval: any;
  followUpInterval: any;
  reconnectTimeout: any;
  revivalInterval: any;
  watchdogInterval: any;
  revivalProcessing: boolean;
  startPromise?: Promise<any> | null;
  reconnectAttempts: number;
  activeTenantId?: string | null;
  lastError?: string | null;
  lastStatusCode?: number | null;
};

if (!globalForBaileys.baileysSession) {
  globalForBaileys.baileysSession = { status: "disconnected", qrCode: null, qrGeneratedAt: null, sock: null };
}
if (globalForBaileys.reconnectAttempts === undefined) {
  globalForBaileys.reconnectAttempts = 0;
}

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

  static async resolveActiveTenantFromSocket(): Promise<string | null> {
    try {
      const sockUserId = globalForBaileys.baileysSession?.sock?.user?.id;
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
        console.log(`[WhatsApp] resolveActiveTenantFromSocket resolved connected phone: ${cleanPhone} -> ${matchedTenant.id}`);
        return matchedTenant.id;
      } else {
        console.log(`[WhatsApp] resolveActiveTenantFromSocket: No tenant matches connected phone number: ${cleanPhone}`);
        return null;
      }
    } catch (err) {
      console.error("[WhatsApp] Error in resolveActiveTenantFromSocket:", err);
      return null;
    }
  }

  static startAutoSync() {
    if (globalForBaileys.autoSyncInterval) {
      clearInterval(globalForBaileys.autoSyncInterval);
    }
    // Run every 6 hours (21600000 ms)
    globalForBaileys.autoSyncInterval = setInterval(async () => {
      try {
        const config = await DB.getConfig();
        if (config.storeUrl) {
          console.log("[Auto-Sync] Scraping store catalog from:", config.storeUrl);
          const { catalog } = await scrapeStore(config.storeUrl, config.storeCurrency || "$");
          if (catalog) {
            // Keep the non-catalog part of productInfo and append the new catalog
            const parts = config.productInfo.split("--- E-COMMERCE CATALOG ---");
            const baseInfo = parts[0].trim();
            await DB.updateConfig({ productInfo: baseInfo + "\n\n" + catalog });
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
        const config = await DB.getConfig();
        const now = Date.now();
        const { generateContextualFollowUp, generateScheduledFollowUp } = await import('./ai-handler');
        
        // --- SYSTEM A: Proactive AI-Scheduled Follow-ups ---
        const pendingSystemAFollowUps = await DB.getPendingFollowUps();
        for (const fu of pendingSystemAFollowUps) {
          const sendAtMs = new Date(fu.sendAt).getTime();
          if (now >= sendAtMs) {
            console.log(`[System A Follow-up] Triggering scheduled follow-up for ${fu.phone}`);
            
            try {
              const aiMessage = await generateScheduledFollowUp(fu.phone, fu.context, fu.tenantId);
              const sentMsg = await this.sendMessage(fu.phone, aiMessage);
              
              await DB.addChatMessage(fu.phone, { id: sentMsg?.key?.id, role: "assistant", content: aiMessage }, fu.tenantId);
              await DB.updateFollowUpStatus(fu.id, "sent", fu.tenantId);
            } catch (err) {
              console.error(`[System A Follow-up] Failed to send to ${fu.phone}:`, err);
              await DB.updateFollowUpStatus(fu.id, "failed", fu.tenantId);
            }
          }
        }

        // Re-fetch in case statuses just changed to 'sent'
        const stillPendingSystemA = await DB.getPendingFollowUps();
        const chats = await DB.getAllChats();
        const orders = await DB.getOrders();
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
              
              await DB.addChatMessage(phone, { id: sentMsg?.key?.id, role: "assistant", content: contextualMessage }, order.tenantId);
              await DB.updateOrder(order.id, { recoveryStage: 1 }, order.tenantId);
            } catch (err) {
              console.error(`[System C Stage 1] Failed for ${phone}:`, err);
            }
          }
          // Stage 2: 6 hours (360 mins)
          else if (currentStage < 2 && elapsedMinutes >= 360) {
            console.log(`[System C Recovery] Triggering Stage 2 for order ${order.id} (${phone})`);
            try {
              const template = `Hi! Just a quick heads-up: we have a lot of interest in the ${order.productName} today, and I can only hold your reservation for another hour before releasing it. Would you like to confirm your details to secure it?`;
              const contextualMessage = await generateContextualFollowUp(phone, template, order.tenantId);
              const sentMsg = await this.sendMessage(phone, contextualMessage);
              
              await DB.addChatMessage(phone, { id: sentMsg?.key?.id, role: "assistant", content: contextualMessage }, order.tenantId);
              await DB.updateOrder(order.id, { recoveryStage: 2 }, order.tenantId);
            } catch (err) {
              console.error(`[System C Stage 2] Failed for ${phone}:`, err);
            }
          }
          // Stage 3: 24 hours (1440 mins)
          else if (currentStage < 3 && elapsedMinutes >= 1440) {
            console.log(`[System C Recovery] Triggering Stage 3 for order ${order.id} (${phone})`);
            try {
              const template = `Hey! I really want to help you get this outfit. If we finalize your order for the ${order.productName} today, I can throw in free shipping. Let me know if you want me to add that in! ðŸŽ`;
              const contextualMessage = await generateContextualFollowUp(phone, template, order.tenantId);
              const sentMsg = await this.sendMessage(phone, contextualMessage);
              
              await DB.addChatMessage(phone, { id: sentMsg?.key?.id, role: "assistant", content: contextualMessage }, order.tenantId);
              await DB.updateOrder(order.id, { recoveryStage: 3 }, order.tenantId);
            } catch (err) {
              console.error(`[System C Stage 3] Failed for ${phone}:`, err);
            }
          }
          // Stage 4: 48 hours (2880 mins)
          else if (currentStage < 4 && elapsedMinutes >= 2880) {
            console.log(`[System C Recovery] Triggering Stage 4 for order ${order.id} (${phone})`);
            try {
              const template = `Hi, since we haven't heard back, I've cancelled your pending order for the ${order.productName} and released the hold on the stock. If you decide to order it later, just send me a message here.`;
              const contextualMessage = await generateContextualFollowUp(phone, template, order.tenantId);
              const sentMsg = await this.sendMessage(phone, contextualMessage);
              
              await DB.addChatMessage(phone, { id: sentMsg?.key?.id, role: "assistant", content: contextualMessage }, order.tenantId);
              await DB.updateOrder(order.id, { recoveryStage: 4, status: "cancelled" }, order.tenantId);
            } catch (err) {
              console.error(`[System C Stage 4] Failed for ${phone}:`, err);
            }
          }
        }

        // --- SYSTEM B: Generic Sequence Follow-ups ---
        console.log(`\n--- [Cron Tick] System B Follow-up Check @ ${new Date(now).toLocaleTimeString()} ---`);

        for (const phone in chats) {
          const messages = chats[phone];
          if (!messages || messages.length === 0) continue;
          
          const customer = await DB.getCustomer(phone);
          const tenantId = customer?.tenantId || 'admin';
          const tenantConfig = await DB.getConfig(tenantId);
          
          if (!tenantConfig.followUps || tenantConfig.followUps.length === 0) continue;
          
          const lastMessage = messages[messages.length - 1];
          const elapsedMs = now - new Date(lastMessage.timestamp).getTime();
          const elapsedMinutes = (elapsedMs / (1000 * 60)).toFixed(2);
          const followUpLevel = customer?.followUpLevel || 0;
          const nextFollowUp = tenantConfig.followUps[followUpLevel];
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

          // If max follow-ups reached based on config, skip
          const maxConfigured = tenantConfig.maxFollowUps !== undefined ? tenantConfig.maxFollowUps : (tenantConfig.followUps?.length || 7);
          const totalFollowUpLevels = Math.min(tenantConfig.followUps?.length || 7, maxConfigured);
          if (followUpLevel >= totalFollowUpLevels) {
            console.log(`  -> Skipping ${phone}: Max follow-up level (${totalFollowUpLevels}) reached.`);
            if (customer?.leadStatus !== "cold") await DB.updateCustomer(phone, { leadStatus: "cold" }, customer?.tenantId);
            continue;
          }

          if (!nextFollowUp || !nextFollowUp.enabled) {
            console.log(`  -> Skipping ${phone}: Follow-up level ${followUpLevel} is disabled or missing.`);
            if (customer?.leadStatus !== "cold") await DB.updateCustomer(phone, { leadStatus: "cold" }, customer?.tenantId);
            continue;
          }

          const delayMs = nextFollowUp.delayMinutes * 60 * 1000;
          if (elapsedMs >= delayMs) {
            console.log(`[System B Follow-up] Evaluating Sequence Level ${followUpLevel + 1} for ${phone}`);
            
            try {
              const { shouldSendFollowUp } = await import('./ai-handler');
              const evaluation = await shouldSendFollowUp(phone, undefined, customer?.tenantId);

              if (!evaluation.shouldFollowUp) {
                console.log(`  -> Skipping follow-up for ${phone}: AI determined follow-up is not needed (Reason: ${evaluation.reason}).`);
                await DB.updateCustomer(phone, { leadStatus: "cold", pipelineStage: "completed" }, customer?.tenantId);
                continue;
              }

              const contextualMessage = await generateContextualFollowUp(phone, nextFollowUp.message, customer?.tenantId);
              const sentMsg = await this.sendMessage(phone, contextualMessage);
              
              await DB.addChatMessage(phone, { id: sentMsg?.key?.id, role: "assistant", content: contextualMessage }, customer?.tenantId);
              await DB.updateCustomer(phone, { followUpLevel: followUpLevel + 1 }, customer?.tenantId);
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

  static startRevivalSync() {
    if (globalForBaileys.revivalInterval) {
      clearInterval(globalForBaileys.revivalInterval);
    }
    // Check every 10 seconds for active campaigns to support responsive delays
    globalForBaileys.revivalInterval = setInterval(async () => {
      // Prevent overlapping processing
      if (globalForBaileys.revivalProcessing) return;
      globalForBaileys.revivalProcessing = true;
      try {
        await this.processRevivalCampaign();
      } catch (e) {
        console.error("[Revival] Processing error:", e);
      } finally {
        globalForBaileys.revivalProcessing = false;
      }
    }, 10000);
  }

  static async processRevivalCampaign() {
    const campaigns = await DB.getRevivalCampaigns();
    const activeCampaigns = campaigns.filter(c => c.status === "active");
    if (activeCampaigns.length === 0) return;

    for (const campaign of activeCampaigns) {
      try {
        // Check delay between individual messages
        const delayMin = campaign.delayMinutes || 5;
        if (campaign.lastSentAt) {
          const lastSentTime = new Date(campaign.lastSentAt).getTime();
          const nextSendTime = lastSentTime + delayMin * 60 * 1000;
          if (Date.now() < nextSendTime) {
            const secsLeft = Math.ceil((nextSendTime - Date.now()) / 1000);
            console.log(`[Revival] Campaign ${campaign.id} is waiting. ${secsLeft} seconds remaining.`);
            continue;
          }
        }

        // Check if WhatsApp is connected
        if (globalForBaileys.baileysSession.status !== "connected" || !globalForBaileys.baileysSession.sock) {
          console.log("[Revival] WhatsApp not connected. Skipping.");
          continue;
        }

        // Check active time slot window (e.g. 09:00 to 21:00)
        const now = new Date();
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();
        const currentTimeMinutes = currentHour * 60 + currentMin;
        const slotStartMinutes = parseInt((campaign.timeSlotStart || "09:00").split(":")[0]) * 60 + parseInt((campaign.timeSlotStart || "09:00").split(":")[1] || "0");
        const slotEndMinutes = parseInt((campaign.timeSlotEnd || "21:00").split(":")[0]) * 60 + parseInt((campaign.timeSlotEnd || "21:00").split(":")[1] || "0");

        if (currentTimeMinutes < slotStartMinutes || currentTimeMinutes >= slotEndMinutes) {
          console.log(`[Revival] Outside time slot (${campaign.timeSlotStart}-${campaign.timeSlotEnd}). Skipping.`);
          continue;
        }

        // Reset daily counter if new day
        const today = now.toISOString().split("T")[0];
        let sentToday = campaign.sentToday || 0;
        if (campaign.lastSentDate !== today) {
          sentToday = 0;
          await DB.updateRevivalCampaign(campaign.id, { sentToday: 0, lastSentDate: today }, campaign.tenantId);
        }

        // Check daily cap
        if (sentToday >= (campaign.dailyCap || 80)) {
          console.log(`[Revival] Daily cap reached (${sentToday}/${campaign.dailyCap}). Waiting for tomorrow.`);
          continue;
        }

        // Initialize leadProgress if missing
        let progressMap: Record<string, any> = campaign.leadProgress || {};

        // 1. Check for Phase 1 sends (Introductory Send to leads not yet sent Intro)
        const sentSet = new Set([...(campaign.sentPhones || []), ...(campaign.failedPhones || [])]);
        const phase1Remaining = (campaign.targetPhones || []).filter(p => !sentSet.has(p));

        let targetPhone = "";
        let isPhase2FollowUp = false;

        if (phase1Remaining.length > 0) {
          targetPhone = phase1Remaining[0];
        } else if (campaign.phase2Settings && campaign.phase2Settings.enabled) {
          // Phase 1 completed, look for Phase 2 follow-ups that are due
          const intervalDays = campaign.phase2Settings.intervalDays || 3;
          const maxFollowUps = campaign.phase2Settings.maxFollowUps || 3;
          const intervalMs = intervalDays * 24 * 60 * 60 * 1000;

          for (const phone of (campaign.sentPhones || [])) {
            // Skip if lead opted out or replied
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
          // Check if all leads are completed
          const p2Enabled = campaign.phase2Settings?.enabled;
          if (!p2Enabled) {
            console.log(`[Revival] Campaign ${campaign.id} completed (Phase 1 finished, Phase 2 disabled).`);
            await DB.updateRevivalCampaign(campaign.id, { status: "completed" }, campaign.tenantId);
          } else {
            // Phase 2 is enabled. Check if ALL sent leads have finished Phase 2 follow-ups.
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
              console.log(`[Revival] Campaign ${campaign.id} completed (All leads finished Phase 2 follow-ups).`);
              await DB.updateRevivalCampaign(campaign.id, { status: "completed" }, campaign.tenantId);
            } else {
              console.log(`[Revival] Campaign ${campaign.id} is active but waiting for next Phase 2 intervals.`);
            }
          }
          continue;
        }

        console.log(`[Revival] Processing ${isPhase2FollowUp ? 'Phase 2 Follow-up' : 'Phase 1 Intro'} for ${targetPhone} in campaign ${campaign.id}`);

        let sentSuccess = false;
        const currentSentPhones = [...(campaign.sentPhones || [])];
        const currentFailedPhones = [...(campaign.failedPhones || [])];

        try {
          if (!isPhase2FollowUp) {
            // Phase 1 send: Text, Media, or Voice Note
            if (campaign.messageType === "voice" && campaign.voiceBase64) {
              const buffer = Buffer.from(campaign.voiceBase64.split(",")[1] || campaign.voiceBase64, "base64");
              await this.sendMedia(targetPhone, buffer, campaign.voiceMimetype || "audio/mp4", "voice_note.mp4", "", true);
            } else if (campaign.mediaBase64 && campaign.mimetype) {
              const buffer = Buffer.from(campaign.mediaBase64.split(",")[1] || campaign.mediaBase64, "base64");
              await this.sendMedia(targetPhone, buffer, campaign.mimetype, campaign.fileName || "document", campaign.message);
            } else {
              await this.sendMessage(targetPhone, campaign.message || "Hello! We miss you!");
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
            // Phase 2 Follow-up Send
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
              await this.sendMedia(targetPhone, buffer, p2.voiceMimetype || "audio/mp4", "followup_voice.mp4", "", true);
            } else if (msgType === "media" && p2.mediaBase64) {
              const buffer = Buffer.from(p2.mediaBase64.split(",")[1] || p2.mediaBase64, "base64");
              await this.sendMedia(targetPhone, buffer, p2.mediaMimetype || "image/jpeg", "followup_media", followUpText);
            } else {
              await this.sendMessage(targetPhone, followUpText);
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

        console.log(`[Revival] Progress updated. Total: ${currentSentPhones.length}/${campaign.targetPhones.length}, Today: ${updatedSentToday}/${campaign.dailyCap}`);
      } catch (e) {
        console.error(`[Revival] Campaign loop error for ${campaign.id}:`, e);
      }
    }
  }

  static startSessionWatchdog() {
    if (globalForBaileys.watchdogInterval) {
      clearInterval(globalForBaileys.watchdogInterval);
    }
    // Check session health every 30 seconds
    globalForBaileys.watchdogInterval = setInterval(async () => {
      try {
        const authFolder = AUTH_FOLDER;
        const credsFile = path.join(authFolder, "creds.json");
        const hasSavedCreds = fs.existsSync(credsFile);

        const currentStatus = globalForBaileys.baileysSession?.status;
        const sock = globalForBaileys.baileysSession?.sock;

        // If credentials exist on disk but status is disconnected or socket is null, auto-reconnect
        if (hasSavedCreds && (currentStatus === "disconnected" || !sock) && !globalForBaileys.startPromise) {
          console.log("[Watchdog] Saved credentials found but WhatsApp is disconnected. Healing connection...");
          const { handleWhatsAppMessage } = await import("./ai-handler");
          this.startSession(async (msg) => {
            await handleWhatsAppMessage(msg);
          }).catch((err) => {
            console.error("[Watchdog] Auto-heal reconnection failed:", err);
          });
        }
      } catch (e) {
        console.error("[Watchdog] Error during health check:", e);
      }
    }, 30000);
  }

  static async ensureConnected() {
    if (globalForBaileys.baileysSession.status === "connected" && globalForBaileys.baileysSession.sock) {
      return globalForBaileys.baileysSession.sock;
    }

    const authFolder = AUTH_FOLDER;
    const credsFile = path.join(authFolder, "creds.json");
    if (fs.existsSync(credsFile)) {
      console.log("[Baileys] Socket not connected when operation requested. Attempting quick auto-reconnect...");
      const { handleWhatsAppMessage } = await import("./ai-handler");
      await this.startSession(async (msg) => {
        await handleWhatsAppMessage(msg);
      });
      if (globalForBaileys.baileysSession.status === "connected" && globalForBaileys.baileysSession.sock) {
        return globalForBaileys.baileysSession.sock;
      }
    }

    throw new Error("WhatsApp not connected. Please connect WhatsApp from the dashboard.");
  }

  static async startSession(onMessage: (msg: any) => void) {
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

    if (globalForBaileys.startPromise) {
      console.log("[Baileys] startSession call received while initialization is in progress. Awaiting existing promise...");
      return globalForBaileys.startPromise;
    }

    if (globalForBaileys.baileysSession.status === "connected" && globalForBaileys.baileysSession.sock) {
      console.log(`[Baileys] startSession called but socket is already connected. Returning existing instance.`);
      return globalForBaileys.baileysSession.sock;
    }

    globalForBaileys.baileysSession.status = "connecting";

    // Load active tenant from Supabase on startup
    if (supabase) {
      try {
        const { data } = await supabase
          .from('whatsapp_auth')
          .select('key_data')
          .eq('tenant_id', 'default')
          .eq('key_id', 'active_tenant')
          .single();
        if (data?.key_data?.activeTenantId) {
          globalForBaileys.activeTenantId = data.key_data.activeTenantId;
          console.log(`[WhatsApp] Loaded active tenant from database on boot: ${globalForBaileys.activeTenantId}`);
        }
      } catch (e) {
        console.warn("[WhatsApp] Could not load active tenant on boot:", e);
      }
    }

    const initPromise = (async () => {
      const { state, saveCreds } = await useSupabaseAuthState("default");
      const logger = pino({ level: "silent" });

      // Fetch the latest WA version with a timeout, falling back to DEFAULT_CONNECTION_CONFIG
      let version = DEFAULT_CONNECTION_CONFIG.version;
      let isLatest = false;
      try {
        const latestPromise = fetchLatestBaileysVersion();
        const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000));
        const latest = await Promise.race([latestPromise, timeoutPromise]) as { version: [number, number, number], isLatest: boolean };
        version = latest.version;
        isLatest = latest.isLatest;
        console.log(`[Baileys] Successfully fetched latest WA version: v${version.join('.')}`);
      } catch (err) {
        console.warn("[Baileys] Failed to fetch latest WA version, using stable default v" + version.join('.') + ":", err);
      }

      // If an existing socket instance was present, cleanly detach listeners before creating a new one
      if (globalForBaileys.baileysSession.sock) {
        try {
          globalForBaileys.baileysSession.sock.ev.removeAllListeners("connection.update");
          globalForBaileys.baileysSession.sock.ev.removeAllListeners("creds.update");
          globalForBaileys.baileysSession.sock.ev.removeAllListeners("messages.upsert");
          globalForBaileys.baileysSession.sock.end(undefined);
        } catch (e) {}
      }

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger,
        browser: Browsers.ubuntu("Chrome"),
      });

      globalForBaileys.baileysSession.sock = sock;

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const qrCodeDataUri = await QRCode.toDataURL(qr, { errorCorrectionLevel: 'M', margin: 2, width: 512 });
            console.log("[Baileys] New QR code generated at", new Date().toISOString());
            globalForBaileys.baileysSession.status = "connecting";
            globalForBaileys.baileysSession.qrCode = qrCodeDataUri;
            globalForBaileys.baileysSession.qrGeneratedAt = Date.now();
          } catch (err) {
            console.error("[Baileys] Error generating QR:", err);
          }
        }

        if (connection === "close") {
          console.log("[WhatsApp] Connection state: disconnected");
          // If we explicitly disconnected, do not reconnect
          if (globalForBaileys.baileysSession.status === "disconnected") {
            console.log("[Baileys] Socket closed after explicit disconnect. Skipping reconnect.");
            globalForBaileys.baileysSession.sock = null;
            return;
          }

          const credsFile = path.join(AUTH_FOLDER, "creds.json");
          const hasLocalCreds = fs.existsSync(credsFile);
          const hasSupabaseCreds = await DB.hasSavedCredentials("default");
          const hasCreds = hasLocalCreds || hasSupabaseCreds;

          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const errorMsg = lastDisconnect?.error?.message || "";
          
          globalForBaileys.lastStatusCode = statusCode || null;
          globalForBaileys.lastError = errorMsg || null;
          
          console.log(`[Baileys] Connection closed. Status code: ${statusCode || 'unknown'}. Error: ${errorMsg}`);
          globalForBaileys.baileysSession.sock = null;

          // If auth credentials exist or if socket closed during QR generation/re-pairing, attempt reconnection
          if (hasCreds || globalForBaileys.baileysSession.qrCode) {
            const currentAttempts = (globalForBaileys.reconnectAttempts || 0) + 1;
            globalForBaileys.reconnectAttempts = currentAttempts;

            // Only clear creds if WhatsApp explicitly logged out device from phone AFTER repeated retries (5+ retries)
            if (statusCode === DisconnectReason.loggedOut && currentAttempts > 5) {
              console.log("[WhatsApp] Connection state: failing to connect (explicit logout from phone).");
              globalForBaileys.baileysSession.status = "disconnected";
              globalForBaileys.baileysSession.qrCode = null;
              globalForBaileys.reconnectAttempts = 0;
              try {
                const { useSupabaseAuthState } = await import("./whatsapp-auth");
                const { removeCreds } = await useSupabaseAuthState("default");
                await removeCreds();
              } catch (e) {}
              if (fs.existsSync(AUTH_FOLDER)) {
                try {
                  fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
                } catch (e) {
                  console.error("Failed to delete auth folder:", e);
                }
              }
              return;
            }

            globalForBaileys.baileysSession.status = "connecting";

            if (!globalForBaileys.reconnectTimeout) {
              const backoffMs = Math.min(10000, Math.pow(2, Math.min(currentAttempts, 4)) * 1000);
              console.log(`[WhatsApp] Connection state: trying to connect... (attempt #${currentAttempts} scheduled in ${backoffMs / 1000}s)`);

              globalForBaileys.reconnectTimeout = setTimeout(() => {
                globalForBaileys.reconnectTimeout = null;
                this.startSession(onMessage).catch(err => {
                  console.error(`[WhatsApp] Connection state: failing to connect. Auto-reconnect attempt #${currentAttempts} failed:`, err);
                });
              }, backoffMs);
            }
          } else {
            console.log("[WhatsApp] Connection state: disconnected (no saved credentials).");
            globalForBaileys.baileysSession.status = "disconnected";
            globalForBaileys.baileysSession.qrCode = null;
            globalForBaileys.reconnectAttempts = 0;
          }
        } else if (connection === "open") {
          console.log("[WhatsApp] Connection state: connected successfully!");
          globalForBaileys.baileysSession.status = "connected";
          globalForBaileys.baileysSession.qrCode = null;
          globalForBaileys.reconnectAttempts = 0;
          if (globalForBaileys.reconnectTimeout) {
            clearTimeout(globalForBaileys.reconnectTimeout);
            globalForBaileys.reconnectTimeout = null;
          }

          // Auto-resolve active tenant from the connected phone number
          WhatsAppManager.resolveActiveTenantFromSocket().catch(err => {
            console.error("[WhatsApp] Error resolving active tenant on connection open:", err);
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
              onMessage(msg);
            } else if (msg.key.fromMe && msg.message) {
              // Message sent by the bot owner (e.g. from their actual phone or by our code)
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
                    await DB.updateCustomer(from, { jid: originalJid }, globalForBaileys.activeTenantId || undefined);
                  }
                  const history = await DB.getChats(from);
                  const exists = history.some((chatMsg: any) => chatMsg.id === msg.key.id);
                  if (!exists) {
                    // Save the owner's manual message as 'assistant' so it appears on the dashboard
                    await DB.addChatMessage(from, { id: msg.key.id || undefined, role: "assistant", content }, globalForBaileys.activeTenantId || undefined);
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

      sock.ev.on("messaging-history.set", async ({ contacts, messages, isLatest }) => {
        // Sync contacts including Groups
        for (const contact of contacts) {
          if (contact.id && contact.id !== "status@broadcast" && !contact.id.endsWith("@newsletter")) {
            const phone = contact.id.replace("@s.whatsapp.net", "").replace("@lid", "");
            if (phone) {
              const isGroup = contact.id.endsWith("@g.us");
              await DB.updateCustomer(phone, { 
                name: contact.name || contact.notify || (isGroup ? `Group: ${phone.split('@')[0]}` : phone),
                jid: contact.id
              }, globalForBaileys.activeTenantId || undefined);
            }
          }
        }

        // Sync historical messages if available
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
                    continue; // Skip ghost chat if real number is unknown
                  }
                }
                from = from?.replace("@s.whatsapp.net", "");
                
                if (from) {
                  if (originalJid) {
                    await DB.updateCustomer(from, { jid: originalJid }, globalForBaileys.activeTenantId || undefined);
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
                    }, globalForBaileys.activeTenantId || undefined);
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
              }, globalForBaileys.activeTenantId || undefined);
            }
          }
        }
      });

      return sock;
    })();

    globalForBaileys.startPromise = initPromise;
    try {
      const sock = await initPromise;
      return sock;
    } finally {
      globalForBaileys.startPromise = null;
    }
  }

  static getStatus() {
    return {
      status: globalForBaileys.baileysSession.status,
      qrCode: globalForBaileys.baileysSession.qrCode,
      qrGeneratedAt: globalForBaileys.baileysSession.qrGeneratedAt,
      phoneNumber: globalForBaileys.baileysSession.sock?.user?.id?.split(":")[0],
      displayName: globalForBaileys.baileysSession.sock?.user?.name || "WhatsApp Business",
      lastError: globalForBaileys.lastError || null,
      lastStatusCode: globalForBaileys.lastStatusCode || null,
      reconnectAttempts: globalForBaileys.reconnectAttempts || 0,
    };
  }

  static async requestPairingCode(phoneNumber: string): Promise<string> {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (!cleanPhone) {
      throw new Error("Invalid phone number format. Please enter full phone number with country code.");
    }

    if (!globalForBaileys.baileysSession.sock) {
      await this.startSession(async () => {});
    }

    const sock = globalForBaileys.baileysSession.sock;
    if (!sock) {
      throw new Error("WhatsApp connection socket is not ready.");
    }

    const rawCode = await sock.requestPairingCode(cleanPhone);
    return rawCode?.match(/.{1,4}/g)?.join('-') || rawCode;
  }

  /**
   * Soft reset: closes the socket and deletes local credentials WITHOUT
   * calling sock.logout(). This is used when re-generating a QR code so
   * WhatsApp servers don't flag the account for rapid re-pairing.
   */
  static async softReset() {
    // Cancel any pending reconnect
    if (globalForBaileys.reconnectTimeout) {
      clearTimeout(globalForBaileys.reconnectTimeout);
      globalForBaileys.reconnectTimeout = null;
    }

    // Mark as disconnected first so connection.update handler doesn't try to reconnect
    globalForBaileys.baileysSession.status = "disconnected";

    if (globalForBaileys.baileysSession.sock) {
      try {
        globalForBaileys.baileysSession.sock.end(undefined);
      } catch (e) {}
    }

    // Allow time for graceful shutdown and file locks to release
    await new Promise(resolve => setTimeout(resolve, 1000));

    globalForBaileys.baileysSession = { status: "disconnected", qrCode: null, qrGeneratedAt: null, sock: null };
    globalForBaileys.startPromise = null;

    const authFolder = AUTH_FOLDER;
    if (fs.existsSync(authFolder)) {
      try {
        fs.rmSync(authFolder, { recursive: true, force: true });
        console.log("[Baileys] Auth folder deleted for fresh QR generation.");
      } catch (e) {
        console.error("Failed to delete auth folder:", e);
      }
    }

    // Also clear Supabase auth credentials for fresh pairing!
    try {
      const { useSupabaseAuthState } = await import("./whatsapp-auth");
      const tenantId = this.getActiveTenantId() || "default";
      // Clear "default" credentials as well since startSession defaults to "default"
      const { removeCreds: removeDefault } = await useSupabaseAuthState("default");
      await removeDefault();
      if (tenantId !== "default") {
        const { removeCreds: removeTenant } = await useSupabaseAuthState(tenantId);
        await removeTenant();
      }
      console.log(`[Baileys] Supabase credentials cleared for fresh QR pairing.`);
    } catch (e) {
      console.error("[Baileys] Failed to clear Supabase credentials:", e);
    }
  }

  /**
   * Full disconnect: calls sock.logout() which tells WhatsApp servers to
   * permanently deregister this linked device. Only use when the user
   * explicitly clicks "Disconnect Device".
   */
  static async disconnect() {
    // Cancel any pending reconnect
    if (globalForBaileys.reconnectTimeout) {
      clearTimeout(globalForBaileys.reconnectTimeout);
      globalForBaileys.reconnectTimeout = null;
    }

    // Mark as disconnected first so connection.update handler doesn't try to reconnect
    globalForBaileys.baileysSession.status = "disconnected";

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
    
    globalForBaileys.baileysSession = { status: "disconnected", qrCode: null, qrGeneratedAt: null, sock: null };
    globalForBaileys.startPromise = null;
    
    const authFolder = AUTH_FOLDER;
    if (fs.existsSync(authFolder)) {
      try {
        fs.rmSync(authFolder, { recursive: true, force: true });
      } catch (e) {
        console.error("Failed to delete auth folder:", e);
      }
    }

    // Also clear Supabase auth credentials!
    try {
      const { useSupabaseAuthState } = await import("./whatsapp-auth");
      const tenantId = this.getActiveTenantId() || "default";
      const { removeCreds: removeDefault } = await useSupabaseAuthState("default");
      await removeDefault();
      if (tenantId !== "default") {
        const { removeCreds: removeTenant } = await useSupabaseAuthState(tenantId);
        await removeTenant();
      }
      console.log(`[Baileys] Supabase credentials cleared on disconnect.`);
    } catch (e) {
      console.error("[Baileys] Failed to clear Supabase credentials on disconnect:", e);
    }
  }

  static async resolveJid(to: string): Promise<string> {
    if (to.includes("@")) {
      return to;
    }
    let cleanPhone = to.replace(/[^\d]/g, "");
    
    // Auto-formatting local numbers (starting with 0) to proper international formatting
    if (cleanPhone.startsWith("0") && !cleanPhone.startsWith("00")) {
      const ownJid = globalForBaileys.baileysSession.sock?.user?.id;
      let countryCode = "92"; // Default fallback to Pakistan
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

    const customer = await DB.getCustomer(cleanPhone);
    if (customer && customer.jid) {
      return customer.jid;
    }
    return `${cleanPhone}@s.whatsapp.net`;
  }

  static async sendTyping(to: string) {
    if (globalForBaileys.baileysSession.status !== "connected" || !globalForBaileys.baileysSession.sock) return;
    const jid = await this.resolveJid(to);
    await globalForBaileys.baileysSession.sock.sendPresenceUpdate('composing', jid);
  }

  static async sendMessage(to: string, text: string) {
    const sock = await this.ensureConnected();
    const jid = await this.resolveJid(to);
    await sock.sendPresenceUpdate('paused', jid);
    const sentMsg = await sock.sendMessage(jid, { text });
    return sentMsg;
  }

  static async sendMedia(to: string, buffer: Buffer, mimetype: string, fileName?: string, caption?: string, isVoiceNote = false) {
    const sock = await this.ensureConnected();
    const jid = await this.resolveJid(to);
    
    let msgObj: any = {};
    if (isVoiceNote || mimetype.startsWith('audio/')) {
        await sock.sendPresenceUpdate('recording', jid);
        // Sometimes WhatsApp expects mp4 or ogg. The ptt flag sets it as a voice note.
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

  static async markChatRead(phone: string, messageIds: string[]) {
    if (globalForBaileys.baileysSession.status !== "connected" || !globalForBaileys.baileysSession.sock || !messageIds.length) return;
    const jid = await this.resolveJid(phone);
    const keys = messageIds.map(id => ({ remoteJid: jid, id, fromMe: false }));
    try {
      await globalForBaileys.baileysSession.sock.readMessages(keys);
    } catch (e) {
      console.error("[Baileys] Failed to mark messages read:", e);
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

  static async sendProductCard(to: string, product: { title: string; price: string; image: string; link: string; id?: string; description?: string }, tenantId?: string) {
    if (globalForBaileys.baileysSession.status !== "connected" || !globalForBaileys.baileysSession.sock) {
      throw new Error("WhatsApp not connected");
    }
    const jid = to.includes("@") ? to : `${to.replace(/[^\d+]/g, "")}@s.whatsapp.net`;
    
    let caption = `*${product.title}*`;
    if (product.price && product.price !== "N/A" && product.price !== "Hidden" && product.price !== "None") {
      caption += `\nPrice: ${product.price}`;
    }
    if (product.description) {
      caption += `\n\n${product.description}`;
    }
    if (product.link) {
      caption += `\n\nView Product: ${product.link}`;
    }
    
    const isValidUrl = (url?: string) => {
      if (!url || typeof url !== 'string') return false;
      const clean = url.trim();
      return (clean.startsWith('http://') || clean.startsWith('https://')) && !clean.includes('example.com');
    };

    if (isValidUrl(product.image)) {
      try {
        await globalForBaileys.baileysSession.sock.sendMessage(jid, { 
          image: { url: product.image.trim() }, 
          caption 
        });
      } catch (e) {
        console.warn("[sendProductCard] Failed to send image, falling back to clean text card:", e);
        await globalForBaileys.baileysSession.sock.sendMessage(jid, { text: caption });
      }
    } else {
      await globalForBaileys.baileysSession.sock.sendMessage(jid, { text: caption });
    }
    
    // Explicitly save the product card to the database so it appears on the dashboard
    const fromStr = jid.replace("@s.whatsapp.net", "");
    await DB.addChatMessage(fromStr, {
      role: "assistant",
      content: `[Product Card: ${product.title}]\nPrice: ${product.price}${product.link ? '\nLink: ' + product.link : ''}`
    }, tenantId);
  }

}

// Ensure intervals are hot-reloaded with the new logic in Next.js dev mode
if (globalForBaileys.baileysSession) {
  WhatsAppManager.startFollowUpsSync();
  WhatsAppManager.startRevivalSync();
  WhatsAppManager.startSessionWatchdog();
}

