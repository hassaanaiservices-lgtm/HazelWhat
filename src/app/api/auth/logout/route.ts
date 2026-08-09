import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const portal = (body as any)?.portal || 'all';

    const res = NextResponse.json({ success: true, message: "Logged out successfully" });

    if (portal === 'admin' || portal === 'all') {
      res.cookies.set("hazel_admin_session", "", { maxAge: 0, path: "/" });
    }
    if (portal === 'client' || portal === 'all') {
      res.cookies.set("hazel_client_session", "", { maxAge: 0, path: "/" });
    }
    // Also clean up old unified cookie if it exists
    res.cookies.set("hazel_session", "", { maxAge: 0, path: "/" });

    return res;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
