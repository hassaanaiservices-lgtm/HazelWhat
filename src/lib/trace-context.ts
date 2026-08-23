import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface TraceContextData {
  requestId: string;
  traceId: string;
  correlationId: string;
  tenantId?: string;
  customerId?: string;
  conversationId?: string;
  service?: string;
  operation?: string;
  startTime: number;
}

const traceContextStorage = new AsyncLocalStorage<TraceContextData>();

export function sanitizeHeaderId(val: string | undefined | null, prefix: string): string {
  if (!val || typeof val !== 'string') {
    return `${prefix}_${randomUUID().replace(/-/g, '').substring(0, 16)}`;
  }

  // Strip anything that is not alphanumeric, underscore, or hyphen (prevents log injection and control chars)
  const cleaned = val.replace(/[^a-zA-Z0-9_-]/g, '').trim();

  // Enforce max length 64 chars and non-empty
  if (cleaned.length === 0 || cleaned.length > 64) {
    return `${prefix}_${randomUUID().replace(/-/g, '').substring(0, 16)}`;
  }

  return cleaned;
}

export function createTraceContext(init: Partial<TraceContextData> = {}): TraceContextData {
  const requestId = sanitizeHeaderId(init.requestId, 'req');
  const traceId = sanitizeHeaderId(init.traceId, 'trc');
  const correlationId = sanitizeHeaderId(init.correlationId, traceId);

  return {
    requestId,
    traceId,
    correlationId,
    tenantId: init.tenantId ? sanitizeHeaderId(init.tenantId, 't') : undefined,
    customerId: init.customerId ? sanitizeHeaderId(init.customerId, 'c') : undefined,
    conversationId: init.conversationId ? sanitizeHeaderId(init.conversationId, 'conv') : undefined,
    service: init.service ? sanitizeHeaderId(init.service, 'service') : 'hazeldid-api',
    operation: init.operation || 'http_request',
    startTime: init.startTime || Date.now(),
  };
}

export function runWithTraceContext<R>(context: TraceContextData, callback: () => R): R {
  return traceContextStorage.run(context, callback);
}

export function getCurrentTraceContext(): TraceContextData | undefined {
  return traceContextStorage.getStore();
}

export function getRequestId(): string {
  return traceContextStorage.getStore()?.requestId || 'req_system_unknown';
}

export function getTraceId(): string {
  return traceContextStorage.getStore()?.traceId || 'trc_system_unknown';
}

export function getCorrelationId(): string {
  return traceContextStorage.getStore()?.correlationId || getTraceId();
}

export function getTenantId(): string | undefined {
  return traceContextStorage.getStore()?.tenantId;
}

export function getCustomerId(): string | undefined {
  return traceContextStorage.getStore()?.customerId;
}

export function getConversationId(): string | undefined {
  return traceContextStorage.getStore()?.conversationId;
}

export function updateTraceContext(updates: Partial<TraceContextData>): void {
  const store = traceContextStorage.getStore();
  if (store) {
    if (updates.tenantId !== undefined) store.tenantId = updates.tenantId ? sanitizeHeaderId(updates.tenantId, 't') : undefined;
    if (updates.customerId !== undefined) store.customerId = updates.customerId ? sanitizeHeaderId(updates.customerId, 'c') : undefined;
    if (updates.conversationId !== undefined) store.conversationId = updates.conversationId ? sanitizeHeaderId(updates.conversationId, 'conv') : undefined;
    if (updates.service !== undefined) store.service = updates.service;
    if (updates.operation !== undefined) store.operation = updates.operation;
  }
}
