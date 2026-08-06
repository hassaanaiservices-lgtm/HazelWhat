import { NextResponse } from "next/server";
import { DB } from "@/lib/db";
import { cookies } from "next/headers";

export async function POST(req: Request) {
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
