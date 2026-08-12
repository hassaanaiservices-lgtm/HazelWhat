import { requireAdminSession } from "@/lib/auth-session";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // Create a client explicitly using the ANON key (simulating the pre-fix state)
  const anonSupabase = createClient(supabaseUrl, anonKey);

  const auditResults: Record<string, { rls_blocked: boolean; error?: string }> = {};

  // Table 1: tenants
  try {
    const { error } = await anonSupabase.from('tenants').insert({ id: 't-test-rls-audit' });
    if (error) {
      auditResults['tenants'] = { rls_blocked: error.code === '42501', error: error.message };
    } else {
      auditResults['tenants'] = { rls_blocked: false };
      await anonSupabase.from('tenants').delete().eq('id', 't-test-rls-audit');
    }
  } catch (e: any) {
    auditResults['tenants'] = { rls_blocked: true, error: e.message };
  }

  // Table 2: partners
  try {
    const { error } = await anonSupabase.from('partners').insert({ id: 'p-test-rls-audit', email: 'audit@test.com' });
    if (error) {
      auditResults['partners'] = { rls_blocked: error.code === '42501', error: error.message };
    } else {
      auditResults['partners'] = { rls_blocked: false };
      await anonSupabase.from('partners').delete().eq('id', 'p-test-rls-audit');
    }
  } catch (e: any) {
    auditResults['partners'] = { rls_blocked: true, error: e.message };
  }

  // Table 3: customers
  try {
    const { error } = await anonSupabase.from('customers').insert({ id: '00000000-0000-0000-0000-000000000000', tenant_id: 't-1004', phone: '000000' });
    if (error) {
      auditResults['customers'] = { rls_blocked: error.code === '42501', error: error.message };
    } else {
      auditResults['customers'] = { rls_blocked: false };
      await anonSupabase.from('customers').delete().eq('id', '00000000-0000-0000-0000-000000000000');
    }
  } catch (e: any) {
    auditResults['customers'] = { rls_blocked: true, error: e.message };
  }

  // Table 4: chat_messages
  try {
    const { error } = await anonSupabase.from('chat_messages').insert({ id: 'msg-test-rls-audit', tenant_id: 't-1004', phone: '000000', role: 'user', content: 'test' });
    if (error) {
      auditResults['chat_messages'] = { rls_blocked: error.code === '42501', error: error.message };
    } else {
      auditResults['chat_messages'] = { rls_blocked: false };
      await anonSupabase.from('chat_messages').delete().eq('id', 'msg-test-rls-audit');
    }
  } catch (e: any) {
    auditResults['chat_messages'] = { rls_blocked: true, error: e.message };
  }

  // Table 5: orders
  try {
    const { error } = await anonSupabase.from('orders').insert({ id: 'ord-test-rls-audit', tenant_id: 't-1004', phone: '000000', product_name: 'test' });
    if (error) {
      auditResults['orders'] = { rls_blocked: error.code === '42501', error: error.message };
    } else {
      auditResults['orders'] = { rls_blocked: false };
      await anonSupabase.from('orders').delete().eq('id', 'ord-test-rls-audit');
    }
  } catch (e: any) {
    auditResults['orders'] = { rls_blocked: true, error: e.message };
  }

  // Table 6: appointments
  try {
    const { error } = await anonSupabase.from('appointments').insert({ id: 'apt-test-rls-audit', tenant_id: 't-1004', phone: '000000' });
    if (error) {
      auditResults['appointments'] = { rls_blocked: error.code === '42501', error: error.message };
    } else {
      auditResults['appointments'] = { rls_blocked: false };
      await anonSupabase.from('appointments').delete().eq('id', 'apt-test-rls-audit');
    }
  } catch (e: any) {
    auditResults['appointments'] = { rls_blocked: true, error: e.message };
  }

  // Table 7: whatsapp_auth
  try {
    const { error } = await anonSupabase.from('whatsapp_auth').insert({ tenant_id: 't-1004', key_id: 'audit-test-rls' });
    if (error) {
      auditResults['whatsapp_auth'] = { rls_blocked: error.code === '42501', error: error.message };
    } else {
      auditResults['whatsapp_auth'] = { rls_blocked: false };
      await anonSupabase.from('whatsapp_auth').delete().eq('key_id', 'audit-test-rls');
    }
  } catch (e: any) {
    auditResults['whatsapp_auth'] = { rls_blocked: true, error: e.message };
  }

  return NextResponse.json({
    success: true,
    message: "Auditing RLS block status under the pre-fix anon key connection configuration.",
    audit: auditResults
  });
}
