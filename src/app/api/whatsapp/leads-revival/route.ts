import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies(req);
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ success: true, campaigns: [], activeCampaign: null });
}

export async function POST(req: Request) {
  return NextResponse.json({ success: false, error: "Lead Revival is currently disabled." }, { status: 403 });
}

export async function PATCH(req: Request) {
  return NextResponse.json({ success: false, error: "Lead Revival is currently disabled." }, { status: 403 });
}

export async function DELETE() {
  return NextResponse.json({ success: false, error: "Lead Revival is currently disabled." }, { status: 403 });
}
