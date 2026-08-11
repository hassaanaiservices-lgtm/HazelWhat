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

  const phone = req.nextUrl.searchParams.get("phone") || "923194188820";
  const tenantId = req.nextUrl.searchParams.get("tenant_id") || "t-1004";

  try {
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', phone)
      .eq('tenant_id', tenantId)
      .single();

    return NextResponse.json({
      phone,
      tenantId,
      customer: customer || null
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
