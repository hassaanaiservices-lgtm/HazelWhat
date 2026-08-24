import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { requireAdminSession } from "@/lib/auth-session";

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET: Show current state in Supabase for all tenants
export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const { data, error } = await supabase
    .from('tenants')
    .select('id, client_username, client_password, status, name, business_name')
    .order('id');

  return NextResponse.json({
    tenants: (data || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      business_name: t.business_name,
      client_username: t.client_username,
      has_password: Boolean(t.client_password),
      password_is_bcrypt: (t.client_password || '').startsWith('$2'),
      password_length: (t.client_password || '').length,
      status: t.status,
    })),
    error: error?.message,
  });
}

// POST: Directly set credentials for a tenant in Supabase
// Body: { tenantId: "t-1004", username: "newuser", password: "NewPass@123" }
export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  try {
    const { tenantId, username, password } = await req.json();

    if (!tenantId || !username || !password) {
      return NextResponse.json({ error: "tenantId, username, and password are required" }, { status: 400 });
    }

    // Check if username is already taken by another tenant
    const { data: existing } = await supabase
      .from('tenants')
      .select('id, client_username')
      .eq('client_username', username.trim())
      .neq('id', tenantId);

    if (existing && existing.length > 0) {
      return NextResponse.json({
        error: `Username "${username}" is already taken by tenant ${existing[0].id}`
      }, { status: 400 });
    }

    // Hash the password
    const hashedPassword = bcrypt.hashSync(password.trim(), 10);

    // Direct Supabase update
    const { data: updated, error: updateError } = await supabase
      .from('tenants')
      .update({
        client_username: username.trim(),
        client_password: hashedPassword,
      })
      .eq('id', tenantId)
      .select('id, client_username, status, name, business_name');

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Credentials updated directly in Supabase for tenant ${tenantId}`,
      updated: updated?.[0],
      credentials_to_use: {
        username: username.trim(),
        password: password.trim(),
        note: "Use EXACTLY these credentials to login"
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
