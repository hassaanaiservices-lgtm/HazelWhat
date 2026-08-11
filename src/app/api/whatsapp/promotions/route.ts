import { NextResponse } from "next/server";
import { DB, PromotionLog } from "@/lib/db";
import { WhatsAppManager } from "@/lib/whatsapp";
import { getSessionFromCookies } from "@/lib/auth-session";
import fs from "fs";
import path from "path";


const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getTenantIdFromSession(req?: any): Promise<string | undefined> {
  const session = await getSessionFromCookies(req);
  return session?.tenantId;
}


export async function GET(req: any) {
  try {
    const tenantId = await getTenantIdFromSession(req);
    if (!tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const logs = await DB.getPromotionLogs(tenantId);
    return NextResponse.json({ success: true, promotions: logs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantIdFromSession();
    const body = await req.json();
    const { message, audience, mediaBase64, mimetype, fileName } = body;

    if ((!message && !mediaBase64) || !audience) {
      return NextResponse.json({ success: false, error: "Missing content or audience" }, { status: 400 });
    }

    const statusInfo = WhatsAppManager.getStatus();
    if (statusInfo.status !== "connected") {
      return NextResponse.json({ 
        success: false, 
        error: "WhatsApp is NOT connected! Please connect your WhatsApp device from the dashboard before sending a broadcast." 
      }, { status: 400 });
    }

    let targetPhones: string[] = [];

    if (audience === "all") {
      const customers = await DB.getAllCustomers(tenantId);
      const chats = await DB.getAllChats(tenantId);
      const chatPhones = Object.keys(chats);
      targetPhones = Array.from(new Set([...customers.map(c => c.phone), ...chatPhones]));
    } else if (audience === "booked") {
      const appointments = await DB.getAllAppointments(tenantId);
      targetPhones = Array.from(new Set(appointments.map(a => a.phone)));
    } else if (audience === "hot") {
      const customers = await DB.getAllCustomers(tenantId);
      targetPhones = Array.from(new Set(customers.filter(c => c.leadStatus === "hot" || c.pipelineStage === "warm").map(c => c.phone)));
    } else if (audience === "cold") {
      const customers = await DB.getAllCustomers(tenantId);
      targetPhones = Array.from(new Set(customers.filter(c => c.leadStatus === "cold" || c.pipelineStage === "cold").map(c => c.phone)));
    } else {
      return NextResponse.json({ success: false, error: "Invalid audience type" }, { status: 400 });
    }

    if (targetPhones.length === 0) {
      return NextResponse.json({ success: false, error: "No customers found for this audience." }, { status: 400 });
    }

    let successCount = 0;
    let failureCount = 0;
    const failures: { phone: string; error: string }[] = [];

    const BATCH_SIZE = 20;
    const BATCH_DELAY_MS = 2000;
    
    let buffer: Buffer | null = null;
    let mediaUrl: string | undefined;

    if (mediaBase64) {
      buffer = Buffer.from(mediaBase64.split(",")[1] || mediaBase64, "base64");
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const uniqueFileName = `${Date.now()}-${fileName || 'media.bin'}`;
      const filePath = path.join(uploadsDir, uniqueFileName);
      fs.writeFileSync(filePath, buffer);
      mediaUrl = `/uploads/${uniqueFileName}`;
    }

    for (let i = 0; i < targetPhones.length; i += BATCH_SIZE) {
      const batch = targetPhones.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (phone) => {
        try {
          if (buffer && mimetype) {
            await WhatsAppManager.sendMedia(phone, buffer, mimetype, fileName || "document", message);
          } else {
            await WhatsAppManager.sendMessage(phone, message);
          }
          
          await DB.addChatMessage(phone, {
            id: Math.random().toString(36).substring(7),
            role: "assistant",
            content: message || '',
            status: 1,
            mediaUrl,
            mediaType: mimetype
          }, tenantId);

          successCount++;
        } catch (e: any) {
          failureCount++;
          failures.push({ phone, error: e.message });
        }
      });

      await Promise.all(batchPromises);

      if (i + BATCH_SIZE < targetPhones.length) {
        await delay(BATCH_DELAY_MS);
      }
    }

    const log: PromotionLog = {
      id: Math.random().toString(36).substring(7),
      tenantId,
      timestamp: new Date().toISOString(),
      audience,
      message: buffer ? `[Media Attached] ${message || ''}` : message,
      successCount,
      failureCount
    };

    await DB.addPromotionLog(log, tenantId);

    return NextResponse.json({ success: true, log, failures });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
