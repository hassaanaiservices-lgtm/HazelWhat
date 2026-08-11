import { requireAdminSession } from "@/lib/auth-session";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
    // 1. Fetch latest 100 chat messages
    const { data: messages, error: msgErr } = await supabase
      .from('chat_messages')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    // 2. Fetch latest 20 orders
    const { data: orders, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(20);

    return NextResponse.json({
      latest_messages: messages || [],
      latest_orders: orders || [],
      errors: {
        msgErr: msgErr?.message || null,
        orderErr: orderErr?.message || null
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
