-- HazelWhat Database Fix: Convert UUID columns to TEXT & Grant Full Access Policies
-- Run this in Supabase Dashboard -> SQL Editor -> New Query -> Run

-- Step 1: Drop foreign key constraints
ALTER TABLE IF EXISTS tenant_configs DROP CONSTRAINT IF EXISTS tenant_configs_tenant_id_fkey;
ALTER TABLE IF EXISTS customers DROP CONSTRAINT IF EXISTS customers_tenant_id_fkey;
ALTER TABLE IF EXISTS chat_messages DROP CONSTRAINT IF EXISTS chat_messages_tenant_id_fkey;
ALTER TABLE IF EXISTS appointments DROP CONSTRAINT IF EXISTS appointments_tenant_id_fkey;
ALTER TABLE IF EXISTS orders DROP CONSTRAINT IF EXISTS orders_tenant_id_fkey;

-- Step 2: Drop existing tables to cleanly rebuild with TEXT IDs
DROP TABLE IF EXISTS scheduled_follow_ups, revival_campaigns, promotion_logs, whatsapp_auth, orders, appointments, chat_messages, customers, tenant_configs, partners, tenants CASCADE;

-- Step 3: Recreate Tables with TEXT tenant_id columns

-- 1. TENANTS TABLE
CREATE TABLE tenants (
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
CREATE TABLE partners (
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
CREATE TABLE tenant_configs (
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CUSTOMERS TABLE
CREATE TABLE customers (
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
CREATE TABLE chat_messages (
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
CREATE TABLE appointments (
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
CREATE TABLE orders (
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
CREATE TABLE scheduled_follow_ups (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  phone TEXT NOT NULL,
  send_at TIMESTAMPTZ NOT NULL,
  context TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. REVIVAL CAMPAIGNS TABLE
CREATE TABLE revival_campaigns (
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
CREATE TABLE whatsapp_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  key_id TEXT NOT NULL,
  key_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_tenant_key UNIQUE (tenant_id, key_id)
);

-- Step 4: Disable RLS / Add Full Access Policies for App Operations
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE partners DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_follow_ups DISABLE ROW LEVEL SECURITY;
ALTER TABLE revival_campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_auth DISABLE ROW LEVEL SECURITY;
