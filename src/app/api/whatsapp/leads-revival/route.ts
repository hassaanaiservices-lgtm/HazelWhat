import { NextResponse } from "next/server";

export async function GET(req: any) {
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
