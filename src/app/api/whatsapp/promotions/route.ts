import { NextResponse } from "next/server";
import { DB, PromotionLog } from "@/lib/db";
import { WhatsAppManager } from "@/lib/whatsapp";
import fs from "fs";
import path from "path";

// Helper for delaying between batches
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET() {
  try {
    const logs = DB.getPromotionLogs();
    return NextResponse.json({ success: true, promotions: logs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, audience, mediaBase64, mimetype, fileName } = body;

    if ((!message && !mediaBase64) || !audience) {
      return NextResponse.json({ success: false, error: "Missing content or audience" }, { status: 400 });
    }

    let targetPhones: string[] = [];

    if (audience === "all") {
      const customers = DB.getAllCustomers();
      const chatPhones = Object.keys(DB.getAllChats());
      targetPhones = Array.from(new Set([...customers.map(c => c.phone), ...chatPhones]));
    } else if (audience === "booked") {
      const appointments = DB.getAllAppointments();
      targetPhones = Array.from(new Set(appointments.map(a => a.phone)));
    } else if (audience === "hot") {
      const customers = DB.getAllCustomers();
      targetPhones = Array.from(new Set(customers.filter(c => c.leadStatus === "hot" || c.pipelineStage === "warm").map(c => c.phone)));
    } else if (audience === "cold") {
      const customers = DB.getAllCustomers();
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

    // Rate Limiting: Process in batches of 20 with 2 seconds delay
    const BATCH_SIZE = 20;
    const BATCH_DELAY_MS = 2000;
    
    let buffer: Buffer | null = null;
    let mediaUrl: string | undefined;

    if (mediaBase64) {
      buffer = Buffer.from(mediaBase64.split(",")[1] || mediaBase64, "base64");
      
      // Save file to public/uploads
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
            await WhatsAppManager.sendMedia(phone, buffer, mimetype, message || fileName);
          } else {
            await WhatsAppManager.sendMessage(phone, message);
          }
          
          // Log to DB so it appears in chat UI
          DB.addChatMessage(phone, {
            id: Math.random().toString(36).substring(7),
            role: "assistant",
            content: message || '',
            status: 1, // Sent
            mediaUrl,
            mediaType: mimetype
          });

          successCount++;
        } catch (e: any) {
          failureCount++;
          failures.push({ phone, error: e.message });
        }
      });

      await Promise.all(batchPromises);

      // Delay if there are more batches
      if (i + BATCH_SIZE < targetPhones.length) {
        await delay(BATCH_DELAY_MS);
      }
    }

    const log: PromotionLog = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      audience,
      message: buffer ? `[Media Attached] ${message || ''}` : message,
      successCount,
      failureCount
    };

    DB.addPromotionLog(log);

    return NextResponse.json({ success: true, log, failures });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
