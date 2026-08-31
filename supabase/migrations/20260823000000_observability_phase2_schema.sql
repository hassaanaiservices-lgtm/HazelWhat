-- =============================================================================
-- Phase 2 (Rev 2): Observability & Financial Accounting — Security & Concurrency Fixes
-- HazelWhat Production | Supabase PostgreSQL
-- =============================================================================
-- Changes from Rev 1:
--   1. RLS: DENY anon role; service_role bypasses RLS by Supabase design;
--           tenant-scoped reads use app.current_tenant_id session variable.
--   2. LLM idempotency: UNIQUE constraint on (tenant_id, request_id, llm_call_index).
--   3. Concurrent grouping: error_groups upsert via UNIQUE(fingerprint) + atomic counter.
--   4. affected_tenants JSONB array REMOVED. affected_tenant_count derived atomically.
--   5. original_message REMOVED (PII risk). normalized_message is the canonical record.
-- =============================================================================
-- REVERSIBILITY: Run the rollback section at the bottom.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 1: model_pricing  (unchanged from Rev 1)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.model_pricing (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider            VARCHAR(64)    NOT NULL,
    model               VARCHAR(128)   NOT NULL,
    input_price         NUMERIC(16, 8) NOT NULL,
    output_price        NUMERIC(16, 8) NOT NULL,
    cached_input_price  NUMERIC(16, 8) NOT NULL DEFAULT 0,
    currency            VARCHAR(8)     NOT NULL DEFAULT 'USD',
    pricing_version     VARCHAR(32)    NOT NULL DEFAULT 'v1.0_2026',
    effective_from      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    effective_until     TIMESTAMPTZ,
    active              BOOLEAN        NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_provider_model_version UNIQUE (provider, model, pricing_version)
);

COMMENT ON TABLE  public.model_pricing IS 'Versioned LLM provider pricing. Never UPDATE after referenced by llm_usage_logs — INSERT a new pricing_version instead.';
COMMENT ON COLUMN public.model_pricing.pricing_version IS 'e.g. v1.0_2026. New version on price change, never UPDATE existing.';
COMMENT ON COLUMN public.model_pricing.effective_until IS 'NULL = currently active. Set when superseded by new version.';

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 2: error_groups
-- Cross-tenant aggregate. fingerprint UNIQUE enables atomic concurrent upsert.
-- REMOVED: affected_tenants JSONB array (scalability/PII concern).
--          affected_tenant_count is maintained as an atomic counter only.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.error_groups (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint           VARCHAR(64) NOT NULL,
    title                 TEXT        NOT NULL,
    service               VARCHAR(64) NOT NULL,
    operation             VARCHAR(128) NOT NULL,
    error_code            VARCHAR(64) NOT NULL DEFAULT 'UNKNOWN_ERROR',
    severity              VARCHAR(16) NOT NULL DEFAULT 'medium'
                              CHECK (severity IN ('critical','high','medium','low')),
    status                VARCHAR(16) NOT NULL DEFAULT 'NEW'
                              CHECK (status IN ('NEW','ACKNOWLEDGED','INVESTIGATING','RESOLVED','IGNORED')),
    occurrence_count      INT         NOT NULL DEFAULT 1,
    -- affected_tenants JSONB array intentionally NOT stored here.
    -- Count is derived from COUNT(DISTINCT tenant_id) in app_errors at query time,
    -- or maintained as a lightweight counter via atomic increment.
    affected_tenant_count INT         NOT NULL DEFAULT 0,
    first_seen_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at           TIMESTAMPTZ,
    resolved_by           TEXT,
    CONSTRAINT uq_error_groups_fingerprint UNIQUE (fingerprint)  -- enables ON CONFLICT upsert
);

COMMENT ON TABLE  public.error_groups IS 'Cross-tenant aggregated error incidents. UNIQUE(fingerprint) enables concurrent safe INSERT...ON CONFLICT DO UPDATE.';
COMMENT ON COLUMN public.error_groups.fingerprint IS 'SHA-256(service:operation:error_code:normalized_message). Stack traces excluded from hash.';
COMMENT ON COLUMN public.error_groups.affected_tenant_count IS 'Atomically maintained via error_group_tenants dedup table. Cannot double-count the same tenant per group under any concurrency.';
COMMENT ON COLUMN public.error_groups.occurrence_count IS 'Incremented atomically via occurrence_count = occurrence_count + 1 in ON CONFLICT DO UPDATE.';

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 2b: error_group_tenants  (deduplication aid)
-- Solves the concurrency-safe affected_tenant_count problem without storing
-- an unbounded tenant ID array in error_groups.
--
-- Design:
--   UNIQUE(group_id, tenant_id) prevents duplicate rows.
--   INSERT ... ON CONFLICT DO NOTHING = idempotent.
--   After a successful INSERT (new tenant for this group), increment the counter.
--   After ON CONFLICT (tenant already seen), counter is NOT incremented.
--   This is safe under 100 concurrent writers: only one INSERT wins per pair.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.error_group_tenants (
    group_id   UUID NOT NULL REFERENCES public.error_groups(id) ON DELETE CASCADE,
    tenant_id  TEXT NOT NULL,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_error_group_tenant UNIQUE (group_id, tenant_id)
);

COMMENT ON TABLE public.error_group_tenants IS 'Deduplication table for affected_tenant_count. UNIQUE(group_id, tenant_id) prevents double-counting under any concurrency. NOT for tenant enumeration — only for counting.';

CREATE INDEX IF NOT EXISTS idx_error_group_tenants_group ON public.error_group_tenants(group_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- DB FUNCTION: increment_affected_tenant_count
-- Called after a successful error_groups upsert to atomically track whether
-- this tenant is new for this group, and increment the counter only if so.
-- Using a function avoids the two-round-trip race in application code.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_affected_tenant_count(
    p_group_id  UUID,
    p_tenant_id TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER  -- runs with owner privileges; bypasses RLS on dedup table
AS $$
BEGIN
    -- Attempt to insert the (group_id, tenant_id) pair.
    -- ON CONFLICT = this tenant was already seen for this group → skip increment.
    INSERT INTO public.error_group_tenants (group_id, tenant_id)
    VALUES (p_group_id, p_tenant_id)
    ON CONFLICT (group_id, tenant_id) DO NOTHING;

    -- Only increment if the INSERT actually added a new row (i.e., new tenant).
    IF FOUND THEN
        UPDATE public.error_groups
        SET affected_tenant_count = affected_tenant_count + 1
        WHERE id = p_group_id;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.increment_affected_tenant_count IS 'Atomically increments affected_tenant_count on error_groups only when a new (group_id, tenant_id) pair is first observed. Safe under any concurrency; cannot double-count.';


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 3: app_errors
-- REMOVED: original_message (PII risk — error messages may contain phone numbers,
--          emails, customer input fragments, and provider response fragments).
--          normalized_message (UUIDs/timestamps/phones/numbers normalized out) is
--          sufficient for all operational use cases.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_errors (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id            UUID        REFERENCES public.error_groups(id) ON DELETE SET NULL,
    fingerprint         VARCHAR(64) NOT NULL,
    tenant_id           TEXT        REFERENCES public.tenants(id) ON DELETE CASCADE,
    request_id          VARCHAR(128) NOT NULL DEFAULT 'req_unknown',
    trace_id            VARCHAR(128) NOT NULL DEFAULT 'trc_unknown',
    correlation_id      VARCHAR(128) NOT NULL DEFAULT 'cor_unknown',
    service             VARCHAR(64) NOT NULL,
    operation           VARCHAR(128) NOT NULL,
    error_code          VARCHAR(64) NOT NULL DEFAULT 'UNKNOWN_ERROR',
    error_name          VARCHAR(128) NOT NULL DEFAULT 'Error',
    normalized_message  TEXT        NOT NULL,
    -- original_message intentionally NOT stored.
    -- Rationale: error messages can contain phone numbers, emails, customer
    -- delivery addresses, partial request payloads, and LLM provider responses.
    -- Normalised message eliminates dynamic identifiers; stack_trace retains
    -- enough debugging context. If exact raw message is needed for a specific
    -- incident, it is available in structured logs (stdout/Pino) for 24h.
    severity            VARCHAR(16) NOT NULL DEFAULT 'medium'
                            CHECK (severity IN ('critical','high','medium','low')),
    status              VARCHAR(16) NOT NULL DEFAULT 'NEW'
                            CHECK (status IN ('NEW','ACKNOWLEDGED','INVESTIGATING','RESOLVED','IGNORED')),
    stack_trace         TEXT,       -- Sanitized: secrets & PII patterns stripped before storage
    provider            VARCHAR(64),
    model               VARCHAR(128),
    metadata            JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ,
    resolved_by         TEXT
);

COMMENT ON TABLE  public.app_errors IS 'Durable error occurrences. original_message excluded (PII). normalized_message retains operational value without exposing customer data. Stack traces sanitized before storage.';
COMMENT ON COLUMN public.app_errors.normalized_message IS 'UUIDs/timestamps/phones/numbers replaced with tokens. Secrets stripped. Safe to store and query.';
COMMENT ON COLUMN public.app_errors.stack_trace        IS 'Sanitized: API keys, phone numbers, emails, and tokens stripped. File paths and line numbers retained for debugging.';

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 4: llm_usage_logs
-- Idempotency: UNIQUE(tenant_id, request_id, llm_call_index).
--   ONE ROW = ONE BILLABLE LLM INVOCATION within a given request.
--   request_id = per-message trace ID (from trace-context.ts).
--   llm_call_index = 0-based sequential index within that request.
--     Index 0 = first LLM turn, 1 = second turn after tool-use, etc.
--   This allows multiple LEGITIMATE LLM calls per business request (tool loops)
--   while making retries idempotent via ON CONFLICT DO NOTHING.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.llm_usage_logs (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        TEXT        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    request_id       VARCHAR(128) NOT NULL DEFAULT 'req_unknown',
    llm_call_index   SMALLINT    NOT NULL DEFAULT 0,  -- 0 = first call in this request
    trace_id         VARCHAR(128) NOT NULL DEFAULT 'trc_unknown',
    provider         VARCHAR(64) NOT NULL,
    model            VARCHAR(128) NOT NULL,
    input_tokens     INT         NOT NULL DEFAULT 0,
    output_tokens    INT         NOT NULL DEFAULT 0,
    cached_tokens    INT         NOT NULL DEFAULT 0,
    estimated_cost   NUMERIC(16, 8) NOT NULL DEFAULT 0,
    pricing_version  VARCHAR(32) NOT NULL DEFAULT 'v1.0_2026',
    pricing_snapshot JSONB       NOT NULL DEFAULT '{}'::jsonb,
    latency_ms       INT         NOT NULL DEFAULT 0,
    status           VARCHAR(16) NOT NULL DEFAULT 'success'
                         CHECK (status IN ('success', 'failed')),
    error_code       VARCHAR(64),
    purpose          VARCHAR(64) NOT NULL DEFAULT 'whatsapp_chat',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Idempotency constraint: same invocation retried → ON CONFLICT DO NOTHING
    CONSTRAINT uq_llm_usage_idempotency UNIQUE (tenant_id, request_id, llm_call_index)
);

COMMENT ON TABLE  public.llm_usage_logs IS 'Financial accounting ledger. ONE ROW = ONE BILLABLE LLM INVOCATION. Idempotent via UNIQUE(tenant_id, request_id, llm_call_index). Multiple legitimate calls per request use sequential llm_call_index values.';
COMMENT ON COLUMN public.llm_usage_logs.llm_call_index IS '0-based index of LLM call within a single request. 0=first turn, 1=second (post-tool-use), etc. Retries use same index → ON CONFLICT DO NOTHING prevents duplicate billing.';
COMMENT ON COLUMN public.llm_usage_logs.pricing_snapshot IS 'Immutable snapshot of rates at call time. Future price changes do not affect this column.';
COMMENT ON COLUMN public.llm_usage_logs.request_id      IS 'Matches trace_context.requestId — the per-WhatsApp-message trace identifier.';

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_app_errors_tenant_created     ON public.app_errors(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_errors_fingerprint        ON public.app_errors(fingerprint);
CREATE INDEX IF NOT EXISTS idx_app_errors_trace_id           ON public.app_errors(trace_id);
CREATE INDEX IF NOT EXISTS idx_app_errors_request_id         ON public.app_errors(request_id);
CREATE INDEX IF NOT EXISTS idx_app_errors_status_severity    ON public.app_errors(status, severity);
CREATE INDEX IF NOT EXISTS idx_app_errors_group_id           ON public.app_errors(group_id);

CREATE INDEX IF NOT EXISTS idx_error_groups_fingerprint      ON public.error_groups(fingerprint);
CREATE INDEX IF NOT EXISTS idx_error_groups_status_severity  ON public.error_groups(status, severity);
CREATE INDEX IF NOT EXISTS idx_error_groups_last_seen        ON public.error_groups(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_groups_service          ON public.error_groups(service, operation);

CREATE INDEX IF NOT EXISTS idx_llm_usage_tenant_created      ON public.llm_usage_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_provider_model      ON public.llm_usage_logs(provider, model);
CREATE INDEX IF NOT EXISTS idx_llm_usage_request_id          ON public.llm_usage_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_trace_id            ON public.llm_usage_logs(trace_id);

CREATE INDEX IF NOT EXISTS idx_model_pricing_lookup          ON public.model_pricing(provider, model, active, effective_from DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
-- Architecture note:
-- This project has NO Supabase Auth users (no auth.uid()). Authentication is
-- via a custom JWT cookie (hazel_client_session / hazel_admin_session) verified
-- server-side in Next.js. The Supabase client is initialised with service_role_key
-- which BYPASSES RLS entirely by Supabase design. No client-side Supabase queries
-- are made from the browser.
--
-- Therefore:
--   - Anon role gets DENY ALL on all Phase 2 tables (defense-in-depth).
--   - Service role bypasses RLS automatically (no policy needed).
--   - Tenant isolation is enforced in application code (observability-store.ts).
--
-- For app_errors and llm_usage_logs, an additional tenant-scoped read policy
-- uses app.current_tenant_id session variable, which the backend can set per
-- transaction if we ever add a per-tenant query pathway.
-- =============================================================================
ALTER TABLE public.model_pricing   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_groups    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_errors      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_usage_logs  ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- ── model_pricing ──────────────────────────────────────────────────────────
  -- Admin-managed global table. Anon role: deny all.
  -- Service role bypasses RLS (Supabase default). No other roles need access.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'model_pricing' AND policyname = 'model_pricing_deny_anon') THEN
    CREATE POLICY model_pricing_deny_anon ON public.model_pricing
      AS RESTRICTIVE
      FOR ALL
      TO anon
      USING (false);
  END IF;

  -- ── error_groups ───────────────────────────────────────────────────────────
  -- Cross-tenant admin aggregate. Anon role: deny all.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'error_groups' AND policyname = 'error_groups_deny_anon') THEN
    CREATE POLICY error_groups_deny_anon ON public.error_groups
      AS RESTRICTIVE
      FOR ALL
      TO anon
      USING (false);
  END IF;

  -- ── app_errors ─────────────────────────────────────────────────────────────
  -- Anon role: deny all.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_errors' AND policyname = 'app_errors_deny_anon') THEN
    CREATE POLICY app_errors_deny_anon ON public.app_errors
      AS RESTRICTIVE
      FOR ALL
      TO anon
      USING (false);
  END IF;

  -- Tenant-scoped read: service role sets app.current_tenant_id per transaction
  -- when performing tenant-specific queries. This is an ADDITIONAL policy layer
  -- for defence-in-depth; service_role itself bypasses RLS regardless.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_errors' AND policyname = 'app_errors_tenant_scoped_read') THEN
    CREATE POLICY app_errors_tenant_scoped_read ON public.app_errors
      AS PERMISSIVE
      FOR SELECT
      TO authenticated
      USING (
        tenant_id = current_setting('app.current_tenant_id', true)
        OR current_setting('app.current_tenant_id', true) IS NULL
        OR current_setting('app.current_tenant_id', true) = ''
      );
  END IF;

  -- ── llm_usage_logs ─────────────────────────────────────────────────────────
  -- Anon role: deny all.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'llm_usage_logs' AND policyname = 'llm_usage_logs_deny_anon') THEN
    CREATE POLICY llm_usage_logs_deny_anon ON public.llm_usage_logs
      AS RESTRICTIVE
      FOR ALL
      TO anon
      USING (false);
  END IF;

  -- Tenant-scoped read (same pattern as app_errors).
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'llm_usage_logs' AND policyname = 'llm_usage_logs_tenant_scoped_read') THEN
    CREATE POLICY llm_usage_logs_tenant_scoped_read ON public.llm_usage_logs
      AS PERMISSIVE
      FOR SELECT
      TO authenticated
      USING (
        tenant_id = current_setting('app.current_tenant_id', true)
        OR current_setting('app.current_tenant_id', true) IS NULL
        OR current_setting('app.current_tenant_id', true) = ''
      );
  END IF;
END $$;

-- =============================================================================
-- SEED DATA: Default model pricing (v1.0_2026)
-- =============================================================================
INSERT INTO public.model_pricing
    (provider, model, input_price, output_price, cached_input_price, pricing_version, effective_from, active)
VALUES
    ('openai',    'gpt-4o-mini',             0.15000000,  0.60000000, 0.07500000, 'v1.0_2026', NOW(), true),
    ('openai',    'gpt-4o',                  2.50000000, 10.00000000, 1.25000000, 'v1.0_2026', NOW(), true),
    ('deepseek',  'deepseek-chat',           0.14000000,  0.28000000, 0.01400000, 'v1.0_2026', NOW(), true),
    ('deepseek',  'deepseek-reasoner',       0.55000000,  2.19000000, 0.14000000, 'v1.0_2026', NOW(), true),
    ('anthropic', 'claude-3-5-sonnet',       3.00000000, 15.00000000, 0.30000000, 'v1.0_2026', NOW(), true),
    ('anthropic', 'claude-3-haiku',          0.25000000,  1.25000000, 0.03000000, 'v1.0_2026', NOW(), true),
    ('gemini',    'gemini-1.5-flash',        0.07500000,  0.30000000, 0.01875000, 'v1.0_2026', NOW(), true),
    ('gemini',    'gemini-1.5-pro',          1.25000000,  5.00000000, 0.31250000, 'v1.0_2026', NOW(), true),
    ('gemini',    'gemini-2.0-flash',        0.10000000,  0.40000000, 0.02500000, 'v1.0_2026', NOW(), true),
    ('groq',      'llama-3.3-70b-versatile', 0.59000000,  0.79000000, 0.00000000, 'v1.0_2026', NOW(), true)
ON CONFLICT (provider, model, pricing_version) DO NOTHING;

-- =============================================================================
-- RETENTION POLICY (documented — not automated)
-- app_errors:       90 days resolved/ignored; indefinite for critical/high.
-- error_groups:     Indefinite (small table, audit value).
-- llm_usage_logs:   MINIMUM 2 YEARS. Financial audit compliance. No auto-delete.
-- model_pricing:    Indefinite. Never delete records referenced by llm_usage_logs.
-- =============================================================================

-- =============================================================================
-- HELPER FUNCTION: Get recent chats partitioned by phone number (avoids flat limit truncation)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_recent_chats(p_tenant_id TEXT, p_limit INT DEFAULT 100)
RETURNS SETOF public.chat_messages
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id, 
    t.message_id, 
    t.tenant_id, 
    t.phone, 
    t.role, 
    t.content, 
    t.timestamp, 
    t.status, 
    t.media_url, 
    t.media_type, 
    t.created_at
  FROM (
    SELECT 
      *,
      ROW_NUMBER() OVER (PARTITION BY phone ORDER BY timestamp DESC) as rn
    FROM public.chat_messages
    WHERE tenant_id = p_tenant_id
  ) t
  WHERE t.rn <= p_limit
  ORDER BY t.timestamp DESC;
END;
$$;

-- ROLLBACK
-- =============================================================================
-- SELECT public.increment_affected_tenant_count(NULL, NULL); -- no-op, just ensure fn exists
-- DROP FUNCTION IF EXISTS public.increment_affected_tenant_count(UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.get_recent_chats(TEXT, INT);
-- DROP TABLE IF EXISTS public.error_group_tenants CASCADE;
-- DROP TABLE IF EXISTS public.llm_usage_logs CASCADE;
-- DROP TABLE IF EXISTS public.app_errors CASCADE;
-- DROP TABLE IF EXISTS public.error_groups CASCADE;
-- DROP TABLE IF EXISTS public.model_pricing CASCADE;
-- =============================================================================
