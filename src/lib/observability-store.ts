import { createHash } from 'node:crypto';
import { supabase } from './db';
import { getCurrentTraceContext } from './trace-context';
import { sanitizeObject, sanitizeString } from './logger';

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ErrorStatus = 'NEW' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED' | 'IGNORED';

export interface AppErrorRecord {
  id?: string;
  groupId?: string;
  fingerprint: string;
  tenantId?: string | null;
  requestId: string;
  traceId: string;
  correlationId: string;
  service: string;
  operation: string;
  errorCode: string;
  errorName: string;
  // original_message intentionally excluded: error messages may contain phone
  // numbers, emails, delivery addresses, and provider response fragments.
  // normalizedMessage (PII stripped) is sufficient for all operational use.
  normalizedMessage: string;
  severity: ErrorSeverity;
  status: ErrorStatus;
  // stackTrace is sanitized (PII stripped) before storage
  stackTrace?: string;
  provider?: string;
  model?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}

export interface ErrorGroupRecord {
  id?: string;
  fingerprint: string;
  title: string;
  service: string;
  operation: string;
  errorCode: string;
  severity: ErrorSeverity;
  status: ErrorStatus;
  occurrenceCount: number;
  // affected_tenants JSONB array removed: unbounded growth risk.
  // affectedTenantCount is maintained as an atomic counter.
  // Exact tenant list derives from COUNT(DISTINCT tenant_id) in app_errors.
  affectedTenantCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}

export interface ModelPricingRecord {
  id?: string;
  provider: string;
  model: string;
  inputPrice: number;        // USD per 1,000,000 input tokens
  outputPrice: number;       // USD per 1,000,000 output tokens
  cachedInputPrice: number;  // USD per 1,000,000 cached input tokens
  currency: string;
  pricingVersion: string;
  effectiveFrom: string;
  effectiveUntil?: string | null;
  active: boolean;
}

export interface LLMUsageRecord {
  id?: string;
  tenantId: string;
  requestId: string;
  // 0-based index of this LLM call within the request.
  // Enables: one business request → multiple legitimate LLM calls (tool loops)
  // Idempotency: retry of same call uses same index → ON CONFLICT DO NOTHING
  llmCallIndex: number;
  traceId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  estimatedCost: number;
  pricingVersion: string;
  pricingSnapshot: {
    inputPrice: number;
    outputPrice: number;
    cachedInputPrice: number;
    currency: string;
  };
  latencyMs: number;
  status: 'success' | 'failed';
  errorCode?: string;
  purpose?: string;
  createdAt?: string;
}

// In-Memory Fallback Storage (Used when Supabase is offline or during testing)
const inMemoryErrorGroups = new Map<string, ErrorGroupRecord>();
const inMemoryAppErrors: AppErrorRecord[] = [];
const inMemoryLLMUsageLogs: LLMUsageRecord[] = [];
// Idempotency set for in-memory LLM usage: key = `${tenantId}:${requestId}:${llmCallIndex}`
const inMemoryLLMUsageKeys = new Set<string>();

// Test mode: forces in-memory path even when Supabase is configured
let _testModeEnabled = false;
export function setObservabilityTestMode(enabled: boolean): void {
  _testModeEnabled = enabled;
}
function useDB(): boolean {
  return !_testModeEnabled && !!supabase;
}

const inMemoryModelPricing = new Map<string, ModelPricingRecord>([
  ['openai:gpt-4o-mini:v1.0_2026', { provider: 'openai', model: 'gpt-4o-mini', inputPrice: 0.15, outputPrice: 0.60, cachedInputPrice: 0.075, currency: 'USD', pricingVersion: 'v1.0_2026', effectiveFrom: new Date().toISOString(), active: true }],
  ['openai:gpt-4o:v1.0_2026', { provider: 'openai', model: 'gpt-4o', inputPrice: 2.50, outputPrice: 10.00, cachedInputPrice: 1.25, currency: 'USD', pricingVersion: 'v1.0_2026', effectiveFrom: new Date().toISOString(), active: true }],
  ['deepseek:deepseek-chat:v1.0_2026', { provider: 'deepseek', model: 'deepseek-chat', inputPrice: 0.14, outputPrice: 0.28, cachedInputPrice: 0.014, currency: 'USD', pricingVersion: 'v1.0_2026', effectiveFrom: new Date().toISOString(), active: true }],
  ['deepseek:deepseek-reasoner:v1.0_2026', { provider: 'deepseek', model: 'deepseek-reasoner', inputPrice: 0.55, outputPrice: 2.19, cachedInputPrice: 0.14, currency: 'USD', pricingVersion: 'v1.0_2026', effectiveFrom: new Date().toISOString(), active: true }],
  ['anthropic:claude-3-5-sonnet:v1.0_2026', { provider: 'anthropic', model: 'claude-3-5-sonnet', inputPrice: 3.00, outputPrice: 15.00, cachedInputPrice: 0.30, currency: 'USD', pricingVersion: 'v1.0_2026', effectiveFrom: new Date().toISOString(), active: true }],
  ['gemini:gemini-1.5-flash:v1.0_2026', { provider: 'gemini', model: 'gemini-1.5-flash', inputPrice: 0.075, outputPrice: 0.30, cachedInputPrice: 0.01875, currency: 'USD', pricingVersion: 'v1.0_2026', effectiveFrom: new Date().toISOString(), active: true }],
]);

/**
 * 1. Normalized Error Fingerprinting Engine
 * Normalizes dynamic values (UUIDs, timestamps, phone numbers, line numbers, memory addresses)
 * before computing a SHA-256 fingerprint hash.
 */
export function normalizeErrorSignature(message: string): string {
  let text = message || '';
  // Replace UUIDs
  text = text.replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '<UUID>');
  // Replace ISO Timestamps
  text = text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, '<TIMESTAMP>');
  // Replace Phone Numbers (international & local)
  text = text.replace(/\+?\d{10,15}/g, '<PHONE>');
  // Replace email addresses
  text = text.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '<EMAIL>');
  // Replace Hex Strings (24+ chars)
  text = text.replace(/0x[0-9a-fA-F]+/g, '<ADDR>');
  text = text.replace(/\b[0-9a-fA-F]{24,64}\b/g, '<HEX>');
  // Replace arbitrary digits
  text = text.replace(/\b\d+\b/g, '<NUM>');
  return text.trim();
}

/** Sanitize stack trace: strip secrets AND PII patterns before storage. */
export function sanitizeStackTrace(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  // First run secret sanitizer
  let s = sanitizeString(stack);
  // Then strip phone numbers and emails from stack
  s = s.replace(/\+?\d{10,15}/g, '<PHONE>');
  s = s.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '<EMAIL>');
  return s;
}

export function computeErrorFingerprint(service: string, operation: string, errorCode: string, message: string, _stackTrace?: string): string {
  // Fingerprint is based ONLY on service + operation + errorCode + normalized message.
  // Stack traces are intentionally excluded: they vary by call depth, async chains, and transpiler
  // output, causing identical errors to produce different fingerprints.
  // Stack traces are stored separately for debugging but do not affect grouping.
  const normalizedSig = normalizeErrorSignature(message);
  const rawString = `${service.toLowerCase()}:${operation.toLowerCase()}:${errorCode.toUpperCase()}:${normalizedSig}`;
  return createHash('sha256').update(rawString).digest('hex');
}

/**
 * 2. Log Application Error & Update Error Group (Durable Storage)
 */
export async function logAppError(params: {
  service: string;
  operation: string;
  error: any;
  errorCode?: string;
  severity?: ErrorSeverity;
  tenantId?: string | null;
  provider?: string;
  model?: string;
  metadata?: Record<string, any>;
}): Promise<{ appErrorId: string; groupId: string; fingerprint: string }> {
  const ctx = getCurrentTraceContext();
  const requestId = ctx?.requestId || 'req_system_unknown';
  const traceId = ctx?.traceId || 'trc_system_unknown';
  const correlationId = ctx?.correlationId || traceId;
  const tenantId = params.tenantId !== undefined ? params.tenantId : (ctx?.tenantId || null);

  const rawMessage = params.error?.message || String(params.error || 'Unknown Error');
  const errorName = params.error?.name || 'Error';
  const errorCode = params.errorCode || params.error?.code || params.error?.status || 'UNKNOWN_ERROR';
  const severity = params.severity || 'medium';

  // Sanitize before storage. original_message is NOT stored (PII risk).
  const sanitizedStack = sanitizeStackTrace(params.error?.stack);
  const sanitizedMeta = sanitizeObject(params.metadata || {});
  const normalizedMsg = normalizeErrorSignature(rawMessage);
  const fingerprint = computeErrorFingerprint(params.service, params.operation, errorCode, rawMessage);
  const now = new Date().toISOString();
  const title = `${params.service}: ${errorName} - ${normalizedMsg.substring(0, 80)}`;

  let groupId = `group_${fingerprint.substring(0, 16)}`;

  // DB Operation: atomic upsert via ON CONFLICT on fingerprint
  if (useDB()) {
    try {
      // Atomic upsert: concurrent identical errors safely increment the counter.
      // occurrence_count and affected_tenant_count use server-side arithmetic.
      const { data: upsertedGroup, error: upsertErr } = await supabase!
        .from('error_groups')
        .upsert({
          fingerprint,
          title,
          service: params.service,
          operation: params.operation,
          error_code: errorCode,
          severity,
          status: 'NEW',
          occurrence_count: 1,
          affected_tenant_count: 0,  // managed exclusively by increment_affected_tenant_count()
          first_seen_at: now,
          last_seen_at: now,
          created_at: now,
        }, {
          onConflict: 'fingerprint',
          ignoreDuplicates: false,
        })
        .select('id, status, occurrence_count')
        .single();

      if (!upsertErr && upsertedGroup) {
        groupId = upsertedGroup.id;

        const nextStatus = (upsertedGroup.status === 'RESOLVED' || upsertedGroup.status === 'IGNORED')
          ? 'NEW' : upsertedGroup.status;

        await supabase!
          .from('error_groups')
          .update({
            occurrence_count: upsertedGroup.occurrence_count + 1,
            last_seen_at: now,
            status: nextStatus,
          })
          .eq('id', groupId);

        // Atomic affected_tenant_count: DB function uses UNIQUE(group_id, tenant_id)
        // on error_group_tenants dedup table. Only one INSERT wins per pair under any
        // concurrency — no double-counting possible.
        if (tenantId) {
          await supabase!.rpc('increment_affected_tenant_count', {
            p_group_id: groupId,
            p_tenant_id: tenantId,
          });
        }
      }

      // Insert app_error record
      const { data: insertedError, error: appErrInsertError } = await supabase!
        .from('app_errors')
        .insert({
          group_id: groupId,
          fingerprint,
          tenant_id: tenantId,
          request_id: requestId,
          trace_id: traceId,
          correlation_id: correlationId,
          service: params.service,
          operation: params.operation,
          error_code: errorCode,
          error_name: errorName,
          normalized_message: normalizedMsg,
          // original_message NOT stored — PII risk
          severity,
          status: 'NEW',
          stack_trace: sanitizedStack,
          provider: params.provider,
          model: params.model,
          metadata: sanitizedMeta,
          created_at: now,
        })
        .select('id')
        .single();

      if (!appErrInsertError) {
        return { appErrorId: insertedError?.id || `err_${Date.now()}`, groupId, fingerprint };
      }
    } catch (dbErr) {
      // Fallback to in-memory on DB error
    }
  }

  // In-Memory Fallback (also handles test mode)
  let group = inMemoryErrorGroups.get(fingerprint);
  if (group) {
    group.occurrenceCount++;
    // Count distinct tenants without storing a list
    const tenantSeenBefore = inMemoryAppErrors.some(
      e => e.fingerprint === fingerprint && e.tenantId === tenantId
    );
    if (tenantId && !tenantSeenBefore) {
      group.affectedTenantCount++;
    }
    group.lastSeenAt = now;
    if (group.status === 'RESOLVED' || group.status === 'IGNORED') {
      group.status = 'NEW';
    }
  } else {
    group = {
      id: groupId,
      fingerprint,
      title,
      service: params.service,
      operation: params.operation,
      errorCode,
      severity,
      status: 'NEW',
      occurrenceCount: 1,
      affectedTenantCount: tenantId ? 1 : 0,
      firstSeenAt: now,
      lastSeenAt: now,
      createdAt: now,
    };
    inMemoryErrorGroups.set(fingerprint, group);
  }

  const appErrorRecord: AppErrorRecord = {
    id: `err_${inMemoryAppErrors.length + 1}`,
    groupId: group.id,
    fingerprint,
    tenantId,
    requestId,
    traceId,
    correlationId,
    service: params.service,
    operation: params.operation,
    errorCode,
    errorName,
    normalizedMessage: normalizedMsg,
    // originalMessage NOT stored
    severity,
    status: 'NEW',
    stackTrace: sanitizedStack,
    provider: params.provider,
    model: params.model,
    metadata: sanitizedMeta,
    createdAt: now,
  };

  inMemoryAppErrors.push(appErrorRecord);
  return { appErrorId: appErrorRecord.id!, groupId: group.id!, fingerprint };
}

/**
 * 3. Update Error Group Lifecycle Status
 */
export async function updateErrorGroupLifecycle(
  groupIdOrFingerprint: string,
  newStatus: ErrorStatus,
  resolvedBy?: string
): Promise<boolean> {
  const now = new Date().toISOString();
  const isResolved = newStatus === 'RESOLVED';

  if (useDB()) {
    try {
      const isUUID = groupIdOrFingerprint.includes('-');
      const query = isUUID
        ? supabase!.from('error_groups').update({
            status: newStatus,
            resolved_at: isResolved ? now : null,
            resolved_by: isResolved ? (resolvedBy || 'admin') : null,
          }).eq('id', groupIdOrFingerprint)
        : supabase!.from('error_groups').update({
            status: newStatus,
            resolved_at: isResolved ? now : null,
            resolved_by: isResolved ? (resolvedBy || 'admin') : null,
          }).eq('fingerprint', groupIdOrFingerprint);

      const { error } = await query;
      if (!error) return true;
    } catch (_) {}
  }

  // In-Memory Fallback
  for (const group of inMemoryErrorGroups.values()) {
    if (group.id === groupIdOrFingerprint || group.fingerprint === groupIdOrFingerprint) {
      group.status = newStatus;
      group.resolvedAt = isResolved ? now : null;
      group.resolvedBy = isResolved ? (resolvedBy || 'admin') : null;
      return true;
    }
  }
  return false;
}

/**
 * 4. Resolve Model Pricing Record
 */
export async function getModelPricing(provider: string, model: string, pricingVersion = 'v1.0_2026'): Promise<ModelPricingRecord> {
  const key = `${provider.toLowerCase()}:${model.toLowerCase()}:${pricingVersion}`;

  if (useDB()) {
    try {
      const { data } = await supabase!
        .from('model_pricing')
        .select('*')
        .eq('provider', provider.toLowerCase())
        .eq('model', model.toLowerCase())
        .eq('active', true)
        .order('effective_from', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        return {
          id: data.id,
          provider: data.provider,
          model: data.model,
          inputPrice: Number(data.input_price),
          outputPrice: Number(data.output_price),
          cachedInputPrice: Number(data.cached_input_price || 0),
          currency: data.currency,
          pricingVersion: data.pricing_version,
          effectiveFrom: data.effective_from,
          active: data.active,
        };
      }
    } catch (_) {}
  }

  const inMem = inMemoryModelPricing.get(key);
  if (inMem) return inMem;

  // Generic fallback if unconfigured
  return {
    provider,
    model,
    inputPrice: 0.15,
    outputPrice: 0.60,
    cachedInputPrice: 0.075,
    currency: 'USD',
    pricingVersion,
    effectiveFrom: new Date().toISOString(),
    active: true,
  };
}

/**
 * 5. Update or Register Model Pricing (Versioned Rate Setter)
 */
export async function setModelPricing(pricing: {
  provider: string;
  model: string;
  inputPrice: number;
  outputPrice: number;
  cachedInputPrice?: number;
  currency?: string;
  pricingVersion?: string;
}): Promise<ModelPricingRecord> {
  const provider = pricing.provider.toLowerCase();
  const model = pricing.model.toLowerCase();
  const pricingVersion = pricing.pricingVersion || `v1.${Date.now()}`;
  const now = new Date().toISOString();

  const record: ModelPricingRecord = {
    provider,
    model,
    inputPrice: pricing.inputPrice,
    outputPrice: pricing.outputPrice,
    cachedInputPrice: pricing.cachedInputPrice || 0,
    currency: pricing.currency || 'USD',
    pricingVersion,
    effectiveFrom: now,
    active: true,
  };

  if (useDB()) {
    try {
      await supabase!
        .from('model_pricing')
        .insert({
          provider,
          model,
          input_price: pricing.inputPrice,
          output_price: pricing.outputPrice,
          cached_input_price: pricing.cachedInputPrice || 0,
          currency: pricing.currency || 'USD',
          pricing_version: pricingVersion,
          effective_from: now,
          active: true,
        });
    } catch (_) {}
  }

  const key = `${provider}:${model}:${pricingVersion}`;
  inMemoryModelPricing.set(key, record);
  return record;
}

/**
 * 6. Log LLM Usage & Financial Accounting Ledger (Durable Billing Record)
 */
export async function logLLMUsage(params: {
  tenantId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  latencyMs: number;
  status?: 'success' | 'failed';
  errorCode?: string;
  purpose?: string;
  // llmCallIndex: 0-based index of this LLM call within the current request.
  // Default 0. Increment for each subsequent LLM turn (tool-use loop).
  // Idempotency: same (tenantId, requestId, llmCallIndex) is a no-op on retry.
  llmCallIndex?: number;
  customRequestId?: string;
  customTraceId?: string;
}): Promise<LLMUsageRecord> {
  if (!params.tenantId) {
    throw new Error('Tenant context (tenantId) is required for LLM usage accounting');
  }

  const ctx = getCurrentTraceContext();
  const requestId = params.customRequestId || ctx?.requestId || `req_llm_${Date.now()}`;
  const traceId = params.customTraceId || ctx?.traceId || `trc_llm_${Date.now()}`;
  const llmCallIndex = params.llmCallIndex ?? 0;

  const cachedTokens = params.cachedTokens || 0;
  const status = params.status || 'success';
  const now = new Date().toISOString();

  // Resolve current active pricing rates
  const pricing = await getModelPricing(params.provider, params.model);

  // Calculate exact cost in USD
  // Cost = (Input * Rate / 1,000,000) + (Output * Rate / 1,000,000) + (Cached * Rate / 1,000,000)
  const inputCost = (params.inputTokens * pricing.inputPrice) / 1_000_000;
  const outputCost = (params.outputTokens * pricing.outputPrice) / 1_000_000;
  const cachedCost = (cachedTokens * pricing.cachedInputPrice) / 1_000_000;
  const estimatedCost = Number((inputCost + outputCost + cachedCost).toFixed(6));

  const pricingSnapshot = {
    inputPrice: pricing.inputPrice,
    outputPrice: pricing.outputPrice,
    cachedInputPrice: pricing.cachedInputPrice,
    currency: pricing.currency,
  };

  const usageRecord: LLMUsageRecord = {
    tenantId: params.tenantId,
    requestId,
    llmCallIndex,
    traceId,
    provider: params.provider.toLowerCase(),
    model: params.model.toLowerCase(),
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    cachedTokens,
    estimatedCost,
    pricingVersion: pricing.pricingVersion,
    pricingSnapshot,
    latencyMs: params.latencyMs,
    status,
    errorCode: params.errorCode,
    purpose: params.purpose || 'whatsapp_chat',
    createdAt: now,
  };

  if (useDB()) {
    try {
      // ON CONFLICT DO NOTHING enforces idempotency at the DB level.
      // Same (tenant_id, request_id, llm_call_index) from a retry = no new row.
      const { data } = await supabase!
        .from('llm_usage_logs')
        .upsert({
          tenant_id: params.tenantId,
          request_id: requestId,
          llm_call_index: llmCallIndex,
          trace_id: traceId,
          provider: params.provider.toLowerCase(),
          model: params.model.toLowerCase(),
          input_tokens: params.inputTokens,
          output_tokens: params.outputTokens,
          cached_tokens: cachedTokens,
          estimated_cost: estimatedCost,
          pricing_version: pricing.pricingVersion,
          pricing_snapshot: pricingSnapshot,
          latency_ms: params.latencyMs,
          status,
          error_code: params.errorCode,
          purpose: params.purpose || 'whatsapp_chat',
          created_at: now,
        }, {
          onConflict: 'tenant_id,request_id,llm_call_index',
          ignoreDuplicates: true,  // retry = no-op
        })
        .select('id')
        .single();

      if (data) usageRecord.id = data.id;
    } catch (_) {}
  }

  // In-memory idempotency guard
  const idempotencyKey = `${params.tenantId}:${requestId}:${llmCallIndex}`;
  if (inMemoryLLMUsageKeys.has(idempotencyKey)) {
    // Retry detected — return existing record without creating a duplicate
    const existing = inMemoryLLMUsageLogs.find(
      u => u.tenantId === params.tenantId && u.requestId === requestId && u.llmCallIndex === llmCallIndex
    );
    if (existing) return existing;
  }
  inMemoryLLMUsageKeys.add(idempotencyKey);

  if (!usageRecord.id) usageRecord.id = `llm_${inMemoryLLMUsageLogs.length + 1}`;
  inMemoryLLMUsageLogs.push(usageRecord);

  return usageRecord;
}

/**
 * 7. Tenant-Isolated Query Helpers
 */
export async function getTenantAppErrors(tenantId: string): Promise<AppErrorRecord[]> {
  if (!tenantId) throw new Error('Tenant context required for errors query');

  if (useDB()) {
    try {
      const { data } = await supabase!
        .from('app_errors')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (data) {
        return data.map(d => ({
          id: d.id,
          groupId: d.group_id,
          fingerprint: d.fingerprint,
          tenantId: d.tenant_id,
          requestId: d.request_id,
          traceId: d.trace_id,
          correlationId: d.correlation_id,
          service: d.service,
          operation: d.operation,
          errorCode: d.error_code,
          errorName: d.error_name,
          normalizedMessage: d.normalized_message,
          // original_message not stored
          severity: d.severity,
          status: d.status,
          stackTrace: d.stack_trace,
          provider: d.provider,
          model: d.model,
          metadata: d.metadata,
          createdAt: d.created_at,
        }));
      }
    } catch (_) {}
  }

  return inMemoryAppErrors.filter(e => e.tenantId === tenantId);
}

export async function getTenantLLMUsage(tenantId: string): Promise<LLMUsageRecord[]> {
  if (!tenantId) throw new Error('Tenant context required for LLM usage query');

  if (useDB()) {
    try {
      const { data } = await supabase!
        .from('llm_usage_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (data) {
        return data.map(d => ({
          id: d.id,
          tenantId: d.tenant_id,
          requestId: d.request_id,
          llmCallIndex: d.llm_call_index ?? 0,
          traceId: d.trace_id,
          provider: d.provider,
          model: d.model,
          inputTokens: d.input_tokens,
          outputTokens: d.output_tokens,
          cachedTokens: d.cached_tokens,
          estimatedCost: Number(d.estimated_cost),
          pricingVersion: d.pricing_version,
          pricingSnapshot: d.pricing_snapshot,
          latencyMs: d.latency_ms,
          status: d.status,
          errorCode: d.error_code,
          purpose: d.purpose,
          createdAt: d.created_at,
        }));
      }
    } catch (_) {}
  }

  return inMemoryLLMUsageLogs.filter(u => u.tenantId === tenantId);
}

export function resetInMemoryObservabilityStore(): void {
  inMemoryErrorGroups.clear();
  inMemoryAppErrors.length = 0;
  inMemoryLLMUsageLogs.length = 0;
  inMemoryLLMUsageKeys.clear();  // Clear idempotency set between tests
}
