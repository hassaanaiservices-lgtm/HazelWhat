import { NextRequest, NextResponse } from "next/server";
import { DB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth-session";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies(req);
    const tenantId = session?.tenantId;

    const { phone, aiEnabled, name, tags, pipelineStage, isLead, pipelineStageSetByUser } = await req.json();

    if (!phone) {
      return NextResponse.json({ success: false, error: "Phone number required" }, { status: 400 });
    }

    const updates: any = {};
    if (aiEnabled !== undefined) updates.aiEnabled = aiEnabled;
    if (name !== undefined) updates.name = name;
    if (tags !== undefined) updates.tags = tags;
    if (pipelineStage !== undefined) {
      updates.pipelineStage = pipelineStage;
      updates.isLead = true;
      updates.pipelineStageSetByUser = true;
    }
    if (isLead !== undefined) updates.isLead = isLead;
    if (pipelineStageSetByUser !== undefined) updates.pipelineStageSetByUser = pipelineStageSetByUser;

    await DB.updateCustomer(phone, updates, tenantId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
