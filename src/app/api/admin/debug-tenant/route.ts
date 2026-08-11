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
      tenant_configs: {
        id: tenantConfig?.id,
        tenant_id: tenantConfig?.tenant_id,
        business_name: tenantConfig?.business_name,
        has_api_key: Boolean(tenantConfig?.api_key || tenantConfig?.apiKey),
        api_key_val: (tenantConfig?.api_key || tenantConfig?.apiKey || "").substring(0, 15),
        has_anthropic_key: Boolean(tenantConfig?.anthropic_api_key || tenantConfig?.anthropicApiKey),
        anthropic_key_val: (tenantConfig?.anthropic_api_key || tenantConfig?.anthropicApiKey || "").substring(0, 15),
      },
      tenants: {
        id: tenant?.id,
        business_name: tenant?.business_name,
        has_api_key: Boolean(tenant?.apiKey || tenant?.api_key),
        api_key_val: (tenant?.apiKey || tenant?.api_key || "").substring(0, 15),
        has_anthropic_key: Boolean(tenant?.anthropicApiKey || tenant?.anthropic_api_key),
        anthropic_key_val: (tenant?.anthropicApiKey || tenant?.anthropic_api_key || "").substring(0, 15),
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
