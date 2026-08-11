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

  const phone = req.nextUrl.searchParams.get("phone") || "923194188820";
  const tenantId = req.nextUrl.searchParams.get("tenant_id") || "t-1004";

  try {
    const { data, error } = await supabase
      .from('customers')
      .update({ ai_enabled: true })
      .eq('phone', phone)
      .eq('tenant_id', tenantId)
      .select();

    return NextResponse.json({
      success: !error,
      error: error?.message || null,
      updated_customer: data || null
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
