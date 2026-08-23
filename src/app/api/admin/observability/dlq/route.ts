import { requireAdminSession } from "@/lib/auth-session";
import { NextRequest, NextResponse } from "next/server";
import { getDlqRecords, retryDlqJob, discardDlqJob, getDlqCount } from "@/lib/queue-manager";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/observability/dlq
 * Returns Dead-Letter Queue (DLQ) records for admin inspection.
 */
export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId") || undefined;

  const records = getDlqRecords(tenantId);
  const count = getDlqCount(tenantId);

  return NextResponse.json({
    success: true,
    dlqCount: count,
    records,
  });
}

/**
 * POST /api/admin/observability/dlq
 * Allows admin to retry or discard a poison job in DLQ.
 * Body: { action: "retry" | "discard", jobId: string }
 */
export async function POST(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, jobId } = body;

    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json({ error: "Missing or invalid jobId" }, { status: 400 });
    }

    if (action === "retry") {
      const ok = await retryDlqJob(jobId);
      if (!ok) {
        return NextResponse.json({ error: "Job ID not found in DLQ" }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: `Job ${jobId} successfully re-enqueued from DLQ.` });
    } else if (action === "discard") {
      const ok = discardDlqJob(jobId);
      if (!ok) {
        return NextResponse.json({ error: "Job ID not found in DLQ" }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: `Job ${jobId} discarded from DLQ.` });
    } else {
      return NextResponse.json({ error: "Invalid action. Supported actions: 'retry', 'discard'" }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process DLQ operation" }, { status: 500 });
  }
}
