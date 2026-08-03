import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("hazel_session");
    return NextResponse.json({ success: true, message: "Logged out successfully" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
