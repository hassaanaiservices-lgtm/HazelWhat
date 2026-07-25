import { NextRequest, NextResponse } from "next/server";
import { DB } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = DB.getConfig();
    return NextResponse.json({ success: true, config });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    DB.updateConfig(body);
    return NextResponse.json({ success: true, config: DB.getConfig() });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
