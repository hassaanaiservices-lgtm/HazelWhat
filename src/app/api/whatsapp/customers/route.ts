import { NextResponse } from "next/server";
import { DB } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { phone, aiEnabled, name, tags, pipelineStage } = await req.json();

    if (!phone) {
      return NextResponse.json({ success: false, error: "Phone number required" }, { status: 400 });
    }

    const updates: any = {};
    if (aiEnabled !== undefined) updates.aiEnabled = aiEnabled;
    if (name !== undefined) updates.name = name;
    if (tags !== undefined) updates.tags = tags;
    if (pipelineStage !== undefined) updates.pipelineStage = pipelineStage;

    DB.updateCustomer(phone, updates);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
