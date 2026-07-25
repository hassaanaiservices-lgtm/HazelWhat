import { NextResponse } from "next/server";
import { DB } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const chats = DB.getAllChats();
    const customers = DB.getAllCustomers();
    return NextResponse.json({ success: true, chats, customers });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
