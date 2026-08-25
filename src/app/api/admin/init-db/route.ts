import { requireAdminSession } from "@/lib/auth-session";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export const FULL_SQL_SCHEMA = `-- Supabase Full Database Schema Migration for HazelWhat
-- Copy and Paste this entire block into Supabase -> SQL Editor -> New Query -> Run

-- 1. TENANTS TABLE
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  client_number TEXT,
  name TEXT,
  business_name TEXT,
  phone_number TEXT,
  email TEXT,
  status TEXT DEFAULT 'active',
  installation_fee NUMERIC DEFAULT 0,
  monthly_subscription_fee NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'PKR',
  payment_status TEXT DEFAULT 'paid',
  allocated_minutes NUMERIC DEFAULT 100,
  used_minutes NUMERIC DEFAULT 0,
  client_username TEXT UNIQUE,
  client_password TEXT,
  system_prompt TEXT,
  knowledge_base TEXT,
  product_knowledge_base TEXT,
  products JSONB DEFAULT '[]'::jsonb,
  followup_mechanism TEXT,
  llm_model TEXT DEFAULT 'gpt-4o-mini',
  temperature NUMERIC DEFAULT 0.7,
  deepgram_voice TEXT DEFAULT 'aura-asteria-en',
  deepgram_api_key TEXT,
  openai_api_key TEXT,
  omnivoice_api_key TEXT,
  omnivoice_number TEXT,
  troubleshoot JSONB DEFAULT '{"webhookConnected": true, "deepgramApiValid": true, "llmApiValid": true, "whatsappSessionActive": true, "serviceBlocked": false}'::jsonb,
  promotions_sent INT DEFAULT 0,
  revival_leads_active INT DEFAULT 0,
  conversational_leads_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PARTNERS TABLE
CREATE TABLE IF NOT EXISTS partners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'partner',
  access_level TEXT DEFAULT 'read_write',
  clients_assigned INT DEFAULT 0,
  permissions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TENANT CONFIGS TABLE
CREATE TABLE IF NOT EXISTS tenant_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE UNIQUE NOT NULL,
  system_prompt TEXT,
  product_info TEXT,
  products JSONB DEFAULT '[]'::jsonb,
  keyword_replies JSONB DEFAULT '[]'::jsonb,
  enabled_features JSONB DEFAULT '[]'::jsonb,
  global_ai_enabled BOOLEAN DEFAULT true,
  store_url TEXT,
  store_currency TEXT DEFAULT '$',
  business_name TEXT,
  timezone TEXT DEFAULT 'UTC',
  working_hours TEXT DEFAULT '9:00 AM - 5:00 PM',
  bot_mode TEXT DEFAULT 'both',
  max_follow_ups INT DEFAULT 7,
  follow_ups JSONB DEFAULT '[]'::jsonb,
  api_key TEXT,
  openrouter_api_key TEXT,
  anthropic_api_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  phone TEXT NOT NULL,
  name TEXT,
  jid TEXT,
  preferences TEXT,
  ai_enabled BOOLEAN DEFAULT true,
  follow_up_level INT DEFAULT 0,
  lead_status TEXT DEFAULT 'none',
  tags JSONB DEFAULT '[]'::jsonb,
  pipeline_stage TEXT DEFAULT 'new',
  is_opted_out BOOLEAN DEFAULT false,
  opted_out_at TIMESTAMPTZ,
  is_lead BOOLEAN DEFAULT false,
  pipeline_stage_set_by_user BOOLEAN DEFAULT false,
  lead_created_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_tenant_customer_phone UNIQUE (tenant_id, phone)
);

-- 5. CHAT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  message_id TEXT,
  status INT DEFAULT 1,
  media_url TEXT,
  media_type TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. APPOINTMENTS TABLE
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  phone TEXT NOT NULL,
  name TEXT,
  service TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  status TEXT DEFAULT 'booked',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  phone TEXT NOT NULL,
  customer_name TEXT,
  product_name TEXT NOT NULL,
  size TEXT,
  color TEXT,
  delivery_address TEXT,
  contact_number TEXT,
  payment_method TEXT,
  price TEXT,
  product_image_url TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SCHEDULED FOLLOW-UPS TABLE
CREATE TABLE IF NOT EXISTS scheduled_follow_ups (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  phone TEXT NOT NULL,
  send_at TIMESTAMPTZ NOT NULL,
  context TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. REVIVAL CAMPAIGNS TABLE
CREATE TABLE IF NOT EXISTS revival_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  target_audience TEXT,
  target_phones JSONB DEFAULT '[]'::jsonb,
  replied_phones JSONB DEFAULT '[]'::jsonb,
  converted_phones JSONB DEFAULT '[]'::jsonb,
  opted_out_phones JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. WHATSAPP AUTH TABLE
CREATE TABLE IF NOT EXISTS whatsapp_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  key_id TEXT NOT NULL,
  key_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_tenant_key UNIQUE (tenant_id, key_id)
);
`;

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase is not configured on this instance' }, { status: 400 });
  }

  const tablesToCheck = [
    'tenants',
    'partners',
    'tenant_configs',
    'customers',
    'chat_messages',
    'appointments',
    'orders',
    'scheduled_follow_ups',
    'revival_campaigns',
    'whatsapp_auth'
  ];

  const tableStatus: Record<string, boolean> = {};

  for (const table of tablesToCheck) {
    try {
      const { error } = await supabase.from(table).select('count', { count: 'exact', head: true });
      tableStatus[table] = !error;
    } catch {
      tableStatus[table] = false;
    }
  }

  const missingTables = Object.keys(tableStatus).filter(t => !tableStatus[t]);

  return NextResponse.json({
    success: true,
    allTablesExist: missingTables.length === 0,
    missingTablesCount: missingTables.length,
    missingTables,
    tableStatus,
    instructions: "If any tables are missing, copy sql_schema below and execute it in Supabase Dashboard -> SQL Editor.",
    sql_schema: FULL_SQL_SCHEMA
  });
}
