-- Supabase Full Database Schema & RLS Migration for HazelWhat
-- Production Multi-Tenant PostgreSQL Schema

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
  message_id TEXT,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  content TEXT,
  status INT DEFAULT 1,
  media_url TEXT,
  media_type TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. APPOINTMENTS TABLE
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  phone TEXT NOT NULL,
  name TEXT,
  service TEXT,
  date TEXT,
  time TEXT,
  status TEXT DEFAULT 'booked',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  phone TEXT NOT NULL,
  customer_name TEXT,
  product_name TEXT NOT NULL,
  product_image_url TEXT,
  size TEXT,
  color TEXT,
  delivery_address TEXT,
  contact_number TEXT,
  payment_method TEXT,
  price TEXT,
  status TEXT DEFAULT 'pending',
  recovery_stage INT DEFAULT 0,
  notes TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  message TEXT,
  audience TEXT,
  time_slot_start TEXT,
  time_slot_end TEXT,
  delay_minutes NUMERIC DEFAULT 5,
  daily_cap INT DEFAULT 80,
  status TEXT DEFAULT 'active',
  target_phones JSONB DEFAULT '[]'::jsonb,
  sent_phones JSONB DEFAULT '[]'::jsonb,
  failed_phones JSONB DEFAULT '[]'::jsonb,
  replied_phones JSONB DEFAULT '[]'::jsonb,
  opted_out_phones JSONB DEFAULT '[]'::jsonb,
  sent_today INT DEFAULT 0,
  last_sent_date TEXT,
  media_base64 TEXT,
  mimetype TEXT,
  file_name TEXT,
  voice_base64 TEXT,
  voice_mimetype TEXT,
  message_type TEXT,
  phase2_settings JSONB DEFAULT '{}'::jsonb,
  lead_progress JSONB DEFAULT '{}'::jsonb,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. PROMOTION LOGS TABLE
CREATE TABLE IF NOT EXISTS promotion_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  audience TEXT,
  message TEXT,
  success_count INT DEFAULT 0,
  failure_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. CALL LOGS TABLE
CREATE TABLE IF NOT EXISTS call_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  caller_number TEXT,
  caller_name TEXT,
  direction TEXT,
  duration_seconds INT,
  transcript_in TEXT,
  transcript_out TEXT,
  audio_url_out TEXT,
  cost_estimate NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_customers_tenant_phone ON customers(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_lead_status ON customers(tenant_id, lead_status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant_phone ON chat_messages(tenant_id, phone, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_date ON appointments(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_scheduled_followups_tenant_status ON scheduled_follow_ups(tenant_id, status, send_at);
CREATE INDEX IF NOT EXISTS idx_revival_campaigns_tenant_status ON revival_campaigns(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_promotion_logs_tenant ON promotion_logs(tenant_id, timestamp DESC);

-- ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE revival_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES (Allow service role and tenant-matching policies)
DO $$
BEGIN
  -- Tenants Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_access_policy') THEN
    CREATE POLICY tenant_access_policy ON tenants FOR ALL USING (true);
  END IF;
  -- Partners Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'partner_access_policy') THEN
    CREATE POLICY partner_access_policy ON partners FOR ALL USING (true);
  END IF;
  -- Tenant Configs Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_configs_access_policy') THEN
    CREATE POLICY tenant_configs_access_policy ON tenant_configs FOR ALL USING (true);
  END IF;
  -- Customers Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customers_access_policy') THEN
    CREATE POLICY customers_access_policy ON customers FOR ALL USING (true);
  END IF;
  -- Chat Messages Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chat_messages_access_policy') THEN
    CREATE POLICY chat_messages_access_policy ON chat_messages FOR ALL USING (true);
  END IF;
  -- Appointments Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'appointments_access_policy') THEN
    CREATE POLICY appointments_access_policy ON appointments FOR ALL USING (true);
  END IF;
  -- Orders Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'orders_access_policy') THEN
    CREATE POLICY orders_access_policy ON orders FOR ALL USING (true);
  END IF;
  -- Scheduled Follow-ups Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'scheduled_followups_access_policy') THEN
    CREATE POLICY scheduled_followups_access_policy ON scheduled_follow_ups FOR ALL USING (true);
  END IF;
  -- Revival Campaigns Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'revival_campaigns_access_policy') THEN
    CREATE POLICY revival_campaigns_access_policy ON revival_campaigns FOR ALL USING (true);
  END IF;
  -- Promotion Logs Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'promotion_logs_access_policy') THEN
    CREATE POLICY promotion_logs_access_policy ON promotion_logs FOR ALL USING (true);
  END IF;
  -- Call Logs Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'call_logs_access_policy') THEN
    CREATE POLICY call_logs_access_policy ON call_logs FOR ALL USING (true);
  END IF;
END $$;
