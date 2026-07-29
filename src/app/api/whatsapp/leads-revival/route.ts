import { NextResponse } from "next/server";
import { DB, RevivalCampaign } from "@/lib/db";

// Safety floor constants — these cannot be bypassed
const SAFETY = {
  MIN_DELAY_SEC: 45,
  MAX_DELAY_SEC: 180,
  MIN_BATCH_SIZE: 1,
  MAX_BATCH_SIZE: 15,
  MIN_BATCH_BREAK_MIN: 30,
  MAX_BATCH_BREAK_MIN: 90,
  MIN_DAILY_CAP: 1,
  MAX_DAILY_CAP: 80,
  MIN_HOUR: 8,   // 08:00
  MAX_HOUR: 22,  // 22:00
};

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function validateTimeSlot(start: string, end: string): { start: string; end: string } {
  const startHour = parseInt(start.split(":")[0], 10);
  const endHour = parseInt(end.split(":")[0], 10);

  const clampedStart = clamp(startHour, SAFETY.MIN_HOUR, SAFETY.MAX_HOUR - 1);
  const clampedEnd = clamp(endHour, clampedStart + 1, SAFETY.MAX_HOUR);

  return {
    start: `${String(clampedStart).padStart(2, "0")}:00`,
    end: `${String(clampedEnd).padStart(2, "0")}:00`,
  };
}

// GET — List all campaigns + active campaign status
export async function GET() {
  try {
    const campaigns = DB.getRevivalCampaigns();
    const active = DB.getActiveCampaign();
    return NextResponse.json({ success: true, campaigns, activeCampaign: active });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST — Create a new campaign
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, audience, timeSlotStart, timeSlotEnd, delayMinSeconds, delayMaxSeconds, batchSize, batchBreakMinutes, dailyCap, mediaBase64, mimetype, fileName } = body;

    if (!message && !mediaBase64) {
      return NextResponse.json({ success: false, error: "Message content is required." }, { status: 400 });
    }

    // Check no active campaign
    const existing = DB.getActiveCampaign();
    if (existing) {
      return NextResponse.json({ success: false, error: "A campaign is already active. Cancel or wait for it to complete." }, { status: 400 });
    }

    // Resolve target phones
    let targetPhones: string[] = [];
    if (audience === "all") {
      const customers = DB.getAllCustomers();
      const chatPhones = Object.keys(DB.getAllChats());
      targetPhones = Array.from(new Set([...customers.map(c => c.phone), ...chatPhones]));
    } else if (audience === "cold") {
      const customers = DB.getAllCustomers();
      targetPhones = customers.filter(c => c.leadStatus === "cold" || c.pipelineStage === "cold").map(c => c.phone);
    } else if (audience === "hot") {
      const customers = DB.getAllCustomers();
      targetPhones = customers.filter(c => c.leadStatus === "hot" || c.pipelineStage === "warm").map(c => c.phone);
    } else if (audience === "new") {
      const customers = DB.getAllCustomers();
      targetPhones = customers.filter(c => !c.pipelineStage || c.pipelineStage === "new").map(c => c.phone);
    } else {
      return NextResponse.json({ success: false, error: "Invalid audience type." }, { status: 400 });
    }

    if (targetPhones.length === 0) {
      return NextResponse.json({ success: false, error: "No leads found for the selected audience." }, { status: 400 });
    }

    // Enforce safety floors
    const safeDelayMin = clamp(delayMinSeconds || 60, SAFETY.MIN_DELAY_SEC, SAFETY.MAX_DELAY_SEC);
    const safeDelayMax = clamp(delayMaxSeconds || 120, safeDelayMin, SAFETY.MAX_DELAY_SEC);
    const safeBatchSize = clamp(batchSize || 10, SAFETY.MIN_BATCH_SIZE, SAFETY.MAX_BATCH_SIZE);
    const safeBatchBreak = clamp(batchBreakMinutes || 45, SAFETY.MIN_BATCH_BREAK_MIN, SAFETY.MAX_BATCH_BREAK_MIN);
    const safeDailyCap = clamp(dailyCap || 80, SAFETY.MIN_DAILY_CAP, SAFETY.MAX_DAILY_CAP);
    const safeTimeSlot = validateTimeSlot(timeSlotStart || "09:00", timeSlotEnd || "21:00");

    const today = new Date().toISOString().split("T")[0];

    const campaign: RevivalCampaign = {
      id: "RV-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
      message: message || "",
      audience: audience || "all",
      timeSlotStart: safeTimeSlot.start,
      timeSlotEnd: safeTimeSlot.end,
      delayMinSeconds: safeDelayMin,
      delayMaxSeconds: safeDelayMax,
      batchSize: safeBatchSize,
      batchBreakMinutes: safeBatchBreak,
      dailyCap: safeDailyCap,
      status: "active",
      targetPhones,
      sentPhones: [],
      failedPhones: [],
      sentToday: 0,
      lastSentDate: today,
      createdAt: new Date().toISOString(),
      mediaBase64,
      mimetype,
      fileName,
    };

    DB.addRevivalCampaign(campaign);

    return NextResponse.json({ success: true, campaign: { ...campaign, mediaBase64: undefined } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH — Pause or resume
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    const active = DB.getActiveCampaign();
    if (!active && action === "pause") {
      return NextResponse.json({ success: false, error: "No active campaign to pause." }, { status: 400 });
    }

    if (action === "pause" && active) {
      DB.updateRevivalCampaign(active.id, { status: "paused" });
      return NextResponse.json({ success: true, message: "Campaign paused." });
    }

    if (action === "resume") {
      // Find the most recent paused campaign
      const campaigns = DB.getRevivalCampaigns();
      const paused = campaigns.filter(c => c.status === "paused").pop();
      if (!paused) {
        return NextResponse.json({ success: false, error: "No paused campaign to resume." }, { status: 400 });
      }
      // Don't resume if there's already an active campaign
      if (DB.getActiveCampaign()) {
        return NextResponse.json({ success: false, error: "Another campaign is already active." }, { status: 400 });
      }
      DB.updateRevivalCampaign(paused.id, { status: "active" });
      return NextResponse.json({ success: true, message: "Campaign resumed." });
    }

    return NextResponse.json({ success: false, error: "Invalid action. Use 'pause' or 'resume'." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE — Cancel the active campaign
export async function DELETE() {
  try {
    const active = DB.getActiveCampaign();
    if (!active) {
      // Also check for paused
      const campaigns = DB.getRevivalCampaigns();
      const paused = campaigns.filter(c => c.status === "paused").pop();
      if (paused) {
        DB.updateRevivalCampaign(paused.id, { status: "cancelled" });
        return NextResponse.json({ success: true, message: "Paused campaign cancelled." });
      }
      return NextResponse.json({ success: false, error: "No active campaign to cancel." }, { status: 400 });
    }
    DB.updateRevivalCampaign(active.id, { status: "cancelled" });
    return NextResponse.json({ success: true, message: "Campaign cancelled." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
