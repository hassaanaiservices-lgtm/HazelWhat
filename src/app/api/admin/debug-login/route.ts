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
    // Query the raw Supabase row for pizzabox_Hayatabad
    const { data: byUsername, error: e1 } = await supabase
      .from('tenants')
      .select('id, client_username, client_password, status, name, business_name')
      .eq('client_username', 'pizzabox_Hayatabad');

    // Also check case-insensitive by fetching all and looking
    const { data: allTenants, error: e2 } = await supabase
      .from('tenants')
      .select('id, client_username, client_password, status, name, business_name')
      .order('id');

    const pizzaboxRows = (allTenants || []).filter((t: any) =>
      (t.client_username || '').toLowerCase().includes('pizzabox')
    );

    return NextResponse.json({
      query_exact: { data: byUsername, error: e1?.message },
      all_tenants_count: (allTenants || []).length,
      pizzabox_matches: pizzaboxRows.map((t: any) => ({
        id: t.id,
        client_username: t.client_username,
        client_password_raw: t.client_password,
        client_password_length: (t.client_password || '').length,
        is_bcrypt: (t.client_password || '').startsWith('$2'),
        status: t.status,
        name: t.name,
        business_name: t.business_name,
      })),
      all_tenants_usernames: (allTenants || []).map((t: any) => ({
        id: t.id,
        username: t.client_username,
        status: t.status,
        has_password: Boolean(t.client_password),
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
