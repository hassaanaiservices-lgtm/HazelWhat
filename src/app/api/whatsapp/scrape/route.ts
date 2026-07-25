import { NextResponse } from "next/server";
import { scrapeStore } from "@/lib/scraper";

export async function POST(req: Request) {
  try {
    const { url, currency = "$" } = await req.json();
    if (!url) {
      return NextResponse.json({ success: false, error: "URL is required" }, { status: 400 });
    }

    try {
      const { catalog, productCount } = await scrapeStore(url, currency);
      return NextResponse.json({ success: true, catalog, productCount });
    } catch (e: any) {
      return NextResponse.json({ success: false, error: e.message || "Failed to scrape URL" }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

