import { NextRequest, NextResponse } from "next/server";
import { scrapeStore } from "@/lib/scraper";
import { requireTenantSession } from "@/lib/auth-session";

export async function POST(req: NextRequest) {
  try {
    const session = await requireTenantSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url, currency = "$" } = await req.json();
    if (!url) {
      return NextResponse.json({ success: false, error: "URL is required" }, { status: 400 });
    }

    try {
      const { catalog, productCount, items } = await scrapeStore(url, currency);
      return NextResponse.json({ success: true, catalog, productCount, items });
    } catch (e: any) {
      return NextResponse.json({ success: false, error: e.message || "Failed to scrape URL" }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

