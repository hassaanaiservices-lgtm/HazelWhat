import { NextResponse } from "next/server";
import { DB, RevivalCampaign } from "@/lib/db";

// Safety floor constants — these cannot be bypassed
const SAFETY = {
  MIN_DELAY_MIN: 0.1,  // 6 seconds
  MAX_DELAY_MIN: 1440, // 24 hours
  MIN_DAILY_CAP: 1,
  MAX_DAILY_CAP: 1000,
  MIN_HOUR: 0,   // 00:00
  MAX_HOUR: 24,  // 24:00
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
    const { 
      name,
      message, 
      audience, 
      timeSlotStart, 
      timeSlotEnd, 
      delayMinutes, 
      dailyCap, 
      mediaBase64, 
      mimetype, 
      fileName,
      voiceBase64,
      voiceMimetype,
      messageType,
      phase2Settings
    } = body;

    if (!message && !mediaBase64 && !voiceBase64) {
      return NextResponse.json({ success: false, error: "Message or Media/Voice content is required." }, { status: 400 });
    }

    // Check no active campaign
    const existing = DB.getActiveCampaign();
    if (existing) {
      return NextResponse.json({ success: false, error: "A campaign is already active. Cancel or wait for it to complete." }, { status: 400 });
    }

    // Resolve target phones
    let targetPhones: string[] = [];
    const allCustomers = DB.getAllCustomers().filter(c => !c.isOptedOut);

    if (audience === "all") {
      const chatPhones = Object.keys(DB.getAllChats());
      targetPhones = Array.from(new Set([...allCustomers.map(c => c.phone), ...chatPhones]));
    } else if (audience === "cold") {
      targetPhones = allCustomers.filter(c => c.leadStatus === "cold" || c.pipelineStage === "cold").map(c => c.phone);
    } else if (audience === "hot") {
      targetPhones = allCustomers.filter(c => c.leadStatus === "hot" || c.pipelineStage === "warm").map(c => c.phone);
    } else if (audience === "new") {
      targetPhones = allCustomers.filter(c => !c.pipelineStage || c.pipelineStage === "new").map(c => c.phone);
    } else if (audience === "custom") {
      if (!Array.isArray(body.customPhones) || body.customPhones.length === 0) {
        return NextResponse.json({ success: false, error: "Custom phone list is empty." }, { status: 400 });
      }
      targetPhones = body.customPhones.map((p: string) => {
        let clean = p.replace(/[^\d]/g, "");
        if (clean.startsWith("0") && !clean.startsWith("00")) {
          clean = "92" + clean.substring(1);
        } else if (clean.startsWith("00")) {
          clean = clean.substring(2);
        }
        return clean;
      }).filter((p: string) => p.length >= 10);
    } else {
      return NextResponse.json({ success: false, error: "Invalid audience type." }, { status: 400 });
    }

    // Filter out any explicitly opted-out phones
    const optOutSet = new Set(DB.getAllCustomers().filter(c => c.isOptedOut).map(c => c.phone));
    targetPhones = targetPhones.filter(phone => !optOutSet.has(phone));

    if (targetPhones.length === 0) {
      return NextResponse.json({ success: false, error: "No non-opted-out leads found for the selected audience." }, { status: 400 });
    }

    // Enforce safety floors
    const safeDelayMinutes = clamp(delayMinutes || 5, SAFETY.MIN_DELAY_MIN, SAFETY.MAX_DELAY_MIN);
    const safeDailyCap = clamp(dailyCap || 80, SAFETY.MIN_DAILY_CAP, SAFETY.MAX_DAILY_CAP);
    const safeTimeSlot = validateTimeSlot(timeSlotStart || "09:00", timeSlotEnd || "21:00");

    const today = new Date().toISOString().split("T")[0];

    const campaign: RevivalCampaign = {
      id: "RV-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
      name: name || `Revival ${new Date().toLocaleDateString()}`,
      message: message || "",
      audience: audience || "all",
      timeSlotStart: safeTimeSlot.start,
      timeSlotEnd: safeTimeSlot.end,
      delayMinutes: safeDelayMinutes,
      dailyCap: safeDailyCap,
      status: "active",
      targetPhones,
      sentPhones: [],
      failedPhones: [],
      repliedPhones: [],
      optedOutPhones: [],
      sentToday: 0,
      lastSentDate: today,
      createdAt: new Date().toISOString(),
      mediaBase64,
      mimetype,
      fileName,
      voiceBase64,
      voiceMimetype,
      messageType: messageType || (voiceBase64 ? "voice" : mediaBase64 ? "media" : "text"),
      phase2Settings: phase2Settings || {
        enabled: false,
        intervalDays: 3,
        maxFollowUps: 3,
        mode: "text",
        messages: ["Checking in to see if you have any questions!"]
      },
      leadProgress: {},
      // Legacy fields mapping
      delayMinSeconds: safeDelayMinutes * 60,
      delayMaxSeconds: safeDelayMinutes * 60,
      batchSize: 1,
      batchBreakMinutes: 0,
    };

    DB.addRevivalCampaign(campaign);

    return NextResponse.json({ success: true, campaign: { ...campaign, mediaBase64: undefined, voiceBase64: undefined } });
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
