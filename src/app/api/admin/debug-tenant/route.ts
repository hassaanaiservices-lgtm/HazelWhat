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

  try {
    const { data: tenantConfig } = await supabase
      .from('tenant_configs')
      .select('*')
      .eq('tenant_id', 't-1001')
      .single();

    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', 't-1001')
      .single();

    return NextResponse.json({
      tenant_configs: tenantConfig || null,
      tenants: tenant || null
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
