import { requireAdminSession } from "@/lib/auth-session";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PIZZA_BOX_DEFAULT_SYSTEM_PROMPT, PIZZA_BOX_DEFAULT_KNOWLEDGE_BASE } from "@/lib/db";

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/seed-db
 * Seeds the Supabase database with tenant and tenant_configs data.
 * This ensures the bot always has the correct system prompt, knowledge base,
 * and tenant records available in Supabase.
 * 
 * GET /api/admin/seed-db
 * Shows what's currently in the database for diagnostics.
 */

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const TENANTS_SEED = [
  {
    id: 'admin',
    client_number: '0000',
    name: 'Admin',
    business_name: 'HazelWhat Admin',
    phone_number: '',
    email: 'admin@hazeldid.com',
    status: 'active',
    installation_fee: 0,
    monthly_subscription_fee: 0,
    currency: 'PKR',
    payment_status: 'paid',
    allocated_minutes: 9999,
    used_minutes: 0,
    client_username: 'admin',
    client_password: 'admin',
  },
  {
    id: 't-1003',
    client_number: '1003',
    name: 'Ayan',
    business_name: 'ayan',
    phone_number: '03194188820',
    email: 'client@business.com',
    status: 'active',
    installation_fee: 0,
    monthly_subscription_fee: 0,
    currency: 'PKR',
    payment_status: 'paid',
    allocated_minutes: 800,
    used_minutes: 0,
    client_username: 'ayan_247',
    client_password: 'client1003',
  },
  {
    id: 't-1004',
    client_number: '1004',
    name: 'Pizza Box',
    business_name: 'Pizza Box',
    phone_number: '03001234567',
    email: 'pizzabox@business.com',
    status: 'active',
    installation_fee: 0,
    monthly_subscription_fee: 9000,
    currency: 'PKR',
    payment_status: 'paid',
    allocated_minutes: 800,
    used_minutes: 0,
    client_username: 'pizzabox_183343',
    client_password: 'client1004',
  },
  {
    id: 't-1002',
    client_number: '1002',
    name: 'Leads',
    business_name: 'Hazeldid Store',
    phone_number: '03177598978',
    email: 'client@business.com',
    status: 'active',
    installation_fee: 0,
    monthly_subscription_fee: 0,
    currency: 'PKR',
    payment_status: 'paid',
    allocated_minutes: 800,
    used_minutes: 0,
    client_username: 'hazeldid_346',
    client_password: 'client1002',
  },
  {
    id: 't-1001',
    client_number: '1001',
    name: 'M Shafiq',
    business_name: 'Trend aura',
    phone_number: '0314 3060320',
    email: 'client@business.com',
    status: 'active',
    installation_fee: 0,
    monthly_subscription_fee: 9000,
    currency: 'PKR',
    payment_status: 'paid',
    allocated_minutes: 800,
    used_minutes: 0,
    client_username: 'trend_aura_423',
    client_password: 'client1001',
  }
];

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return executeSeed();
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return executeSeed();
}

async function executeSeed() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const results: string[] = [];

  try {
    // 1. Seed tenants table
    for (const tenant of TENANTS_SEED) {
      const { error } = await supabase
        .from('tenants')
        .upsert(tenant, { onConflict: 'id' });
      
      if (error) {
        results.push(`❌ Tenant ${tenant.id} (${tenant.business_name}): ${error.message}`);
      } else {
        results.push(`✅ Tenant ${tenant.id} (${tenant.business_name}): seeded`);
      }
    }

    // 2. Seed tenant_configs for Pizza Box (t-1004)
    const pizzaBoxConfig = {
      tenant_id: 't-1004',
      system_prompt: PIZZA_BOX_DEFAULT_SYSTEM_PROMPT,
      product_info: PIZZA_BOX_DEFAULT_KNOWLEDGE_BASE,
      business_name: 'Pizza Box',
      global_ai_enabled: true,
      products: [],
    };

    const { error: configError } = await supabase
      .from('tenant_configs')
      .upsert(pizzaBoxConfig, { onConflict: 'tenant_id' });

    if (configError) {
      results.push(`❌ Config t-1004 (Pizza Box): ${configError.message}`);
    } else {
      results.push(`✅ Config t-1004 (Pizza Box): system prompt + knowledge base seeded`);
    }

    // 3. Create default admin config if missing
    const { error: adminCfgError } = await supabase
      .from('tenant_configs')
      .upsert({
        tenant_id: 'admin',
        system_prompt: '',
        product_info: '',
        business_name: 'HazelWhat Admin',
        global_ai_enabled: true,
        products: [],
      }, { onConflict: 'tenant_id' });

    if (adminCfgError) {
      results.push(`❌ Config admin: ${adminCfgError.message}`);
    } else {
      results.push(`✅ Config admin: seeded`);
    }

    // 4. Verify final state
    const { data: finalTenants } = await supabase.from('tenants').select('id, business_name');
    const { data: finalConfigs } = await supabase.from('tenant_configs').select('tenant_id, business_name');

    return NextResponse.json({
      message: "Database seeded successfully!",
      results,
      final_state: {
        tenants: finalTenants || [],
        configs: finalConfigs || [],
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, results }, { status: 500 });
  }
}
