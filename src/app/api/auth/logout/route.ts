import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const body = await request.json().catch(() => ({}));
    const portal = (body as any)?.portal || 'all';

    if (portal === 'admin' || portal === 'all') {
      cookieStore.delete("hazel_admin_session");
    }
    if (portal === 'client' || portal === 'all') {
      cookieStore.delete("hazel_client_session");
    }

    // Also clean up old unified cookie if it exists
    cookieStore.delete("hazel_session");

    return NextResponse.json({ success: true, message: "Logged out successfully" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
