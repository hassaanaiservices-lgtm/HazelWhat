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
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const ordId = "TEST-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  const testOrder = {
    id: ordId,
    tenant_id: "t-1004",
    phone: "923194188820",
    customer_name: "Test Customer",
    product_name: "Chicken Tikka Pizza (Large)",
    product_image_url: null,
    size: "Large",
    color: "N/A",
    delivery_address: "Test Address 123",
    contact_number: "923194188820",
    payment_method: "COD",
    price: "1507",
    status: "pending",
    recovery_stage: 0,
    notes: "Test Notes",
    timestamp: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('orders')
      .insert(testOrder)
      .select();

    return NextResponse.json({
      success: !error,
      error: error || null,
      inserted: data || null
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
