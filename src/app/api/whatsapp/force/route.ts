import { NextRequest, NextResponse } from "next/server";
import { WhatsAppManager } from "@/lib/whatsapp";
import { DB } from "@/lib/db";
import { cookies } from "next/headers";

export async function GET() {
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };

  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("hazel_session");
    let tenantId: string | undefined;
    if (sessionCookie && sessionCookie.value) {
      try {
        const session = JSON.parse(sessionCookie.value);
        tenantId = session.role === 'admin' ? undefined : session.tenantId;
      } catch (e) {}
    }

    const config = await DB.getConfig(tenantId);
    const now = Date.now();
    
    log(`\n--- [Forced Tick] System B Follow-up Check @ ${new Date(now).toLocaleTimeString()} ---`);

    const chats = await DB.getAllChats(tenantId);
    const stillPendingSystemA = await DB.getPendingFollowUps(tenantId);

    for (const phone in chats) {
      if (phone !== "923236349759") continue;

      const messages = chats[phone];
      if (!messages || messages.length === 0) continue;
      
      const lastMessage = messages[messages.length - 1];
      const elapsedMs = now - new Date(lastMessage.timestamp).getTime();
      const elapsedMinutes = (elapsedMs / (1000 * 60)).toFixed(2);
      const customer = await DB.getCustomer(phone, tenantId);
      const followUpLevel = customer?.followUpLevel || 0;
      const nextFollowUp = config.followUps?.[followUpLevel];
      const requiredMinutes = nextFollowUp?.delayMinutes || 0;
      const exceedsWait = elapsedMs >= (requiredMinutes * 60 * 1000);

      log(`[Phone: ${phone}] Last Msg: ${lastMessage.role} @ ${new Date(lastMessage.timestamp).toLocaleTimeString()} | Elapsed: ${elapsedMinutes}m | Required: ${requiredMinutes}m | Meets Time: ${exceedsWait} | Level: ${followUpLevel}`);

      if (lastMessage.role !== 'assistant') {
        log(`  -> Skipping ${phone}: Last message was from user.`);
        continue;
      }

      const hasPendingSystemA = stillPendingSystemA.some(f => f.phone === phone);
      if (hasPendingSystemA) {
        log(`  -> Skipping ${phone}: System A has a pending follow-up.`);
        continue;
      }

      const totalFollowUpLevels = config.followUps?.length || 7;
      if (followUpLevel >= totalFollowUpLevels) {
        log(`  -> Skipping ${phone}: Max follow-up level (${totalFollowUpLevels}) reached.`);
        continue;
      }

      if (!nextFollowUp || !nextFollowUp.enabled) {
        log(`  -> Skipping ${phone}: Follow-up level ${followUpLevel} is disabled or missing.`);
        continue;
      }

      const delayMs = nextFollowUp.delayMinutes * 60 * 1000;
      if (elapsedMs >= delayMs) {
        log(`[System B Follow-up] Evaluating Sequence Level ${followUpLevel + 1} for ${phone}`);
        try {
          const { shouldSendFollowUp, generateContextualFollowUp } = await import("@/lib/ai-handler");
          const evaluation = await shouldSendFollowUp(phone, undefined, tenantId);
          
          if (!evaluation.shouldFollowUp) {
            log(`  -> Skipping ${phone}: Deal closed/resolved (${evaluation.reason})`);
            await DB.updateCustomer(phone, { leadStatus: "cold", pipelineStage: "completed" }, tenantId);
            continue;
          }

          const contextualMessage = await generateContextualFollowUp(phone, nextFollowUp.message, tenantId);
          const sentMsg = await WhatsAppManager.sendMessage(phone, contextualMessage);
          await DB.addChatMessage(phone, { id: sentMsg?.key?.id, role: "assistant", content: contextualMessage }, tenantId);
          await DB.updateCustomer(phone, { followUpLevel: followUpLevel + 1 }, tenantId);
          log(`  -> Success! Message sent.`);
        } catch (err: any) {
          log(`  -> Error sending message: ${err.message}`);
        }
      }
    }

    return NextResponse.json({ success: true, logs });
  } catch (err: any) {
    log(`Global Error: ${err.message}`);
    return NextResponse.json({ success: false, logs, error: err.message }, { status: 500 });
  }
}
