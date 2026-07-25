import { NextResponse } from "next/server";
import { DB } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { phone, aiEnabled } = await req.json();

    if (!phone) {
      return NextResponse.json({ success: false, error: "Phone number required" }, { status: 400 });
    }

    DB.updateCustomer(phone, { aiEnabled });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
