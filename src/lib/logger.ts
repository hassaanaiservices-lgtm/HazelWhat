import pino from 'pino';
import { getCurrentTraceContext } from './trace-context';

const SENSITIVE_KEYS = [
  'apiKey',
  'anthropicApiKey',
  'openRouterApiKey',
  'deepgramApiKey',
  'password',
  'secret',
  'authorization',
  'token',
  'bearer',
  'cookie',
  'creditCard',
  'cvv',
  'ssn',
  '*.apiKey',
  '*.password',
  '*.secret',
  '*.token',
  '*.authorization',
];

const SECRET_REGEX_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{8,}/g,
  /Bearer\s+\S+/gi,
  /eyJ[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*/g,
];

export function sanitizeString(val: string): string {
  if (!val) return val;
  let sanitized = val;
  for (const pattern of SECRET_REGEX_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED_SECRET]');
  }
  return sanitized;
}

export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return sanitizeString(obj) as any;
  }
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as any;
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    const isSensitiveKey = SENSITIVE_KEYS.some(k => k.replace('*.', '') === key) ||
      keyLower.includes('secret') ||
      keyLower.includes('password') ||
      keyLower.includes('apikey') ||
      keyLower.includes('auth') ||
      keyLower.includes('cookie');

    if (isSensitiveKey) {
      if (Array.isArray(value)) {
        result[key] = value.map(item => typeof item === 'string' ? sanitizeString(item) : '[REDACTED]');
      } else {
        result[key] = '[REDACTED]';
      }
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value);
    } else if (typeof value === 'string') {
      result[key] = sanitizeString(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

const basePino = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: SENSITIVE_KEYS,
    censor: '[REDACTED]',
  },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

function getTraceMetadata() {
  const ctx = getCurrentTraceContext();
  return {
    request_id: ctx?.requestId || 'req_system_unknown',
    trace_id: ctx?.traceId || 'trc_system_unknown',
    correlation_id: ctx?.correlationId || ctx?.traceId || 'trc_system_unknown',
    tenant_id: ctx?.tenantId || null,
    customer_id: ctx?.customerId || null,
    conversation_id: ctx?.conversationId || null,
    service: ctx?.service || 'hazeldid-api',
    operation: ctx?.operation || 'general',
    environment: process.env.NODE_ENV || 'development',
  };
}

export const logger = {
  info(message: string, meta: Record<string, any> = {}, operation?: string) {
    try {
      const traceMeta = getTraceMetadata();
      const sanitizedMeta = sanitizeObject(meta);
      basePino.info({
        ...traceMeta,
        ...(operation ? { operation } : {}),
        ...sanitizedMeta,
        message: sanitizeString(message),
      });
    } catch (fallbackErr) {
      console.log(`[LOGGER FALLBACK INFO]: ${message}`);
    }
  },

  warn(message: string, meta: Record<string, any> = {}, operation?: string) {
    try {
      const traceMeta = getTraceMetadata();
      const sanitizedMeta = sanitizeObject(meta);
      basePino.warn({
        ...traceMeta,
        ...(operation ? { operation } : {}),
        ...sanitizedMeta,
        message: sanitizeString(message),
      });
    } catch (fallbackErr) {
      console.warn(`[LOGGER FALLBACK WARN]: ${message}`);
    }
  },

  error(message: string, error?: any, meta: Record<string, any> = {}, operation?: string) {
    try {
      const traceMeta = getTraceMetadata();
      const sanitizedMeta = sanitizeObject(meta);

      let errorDetails: Record<string, any> = {};
      if (error) {
        errorDetails = {
          error_name: error.name || 'Error',
          error_code: error.code || error.status || 'UNKNOWN_ERROR',
          error_message: sanitizeString(error.message || String(error)),
          stack_trace: error.stack ? sanitizeString(error.stack) : undefined,
        };
      }

      basePino.error({
        ...traceMeta,
        ...(operation ? { operation } : {}),
        ...errorDetails,
        ...sanitizedMeta,
        message: sanitizeString(message),
      });
    } catch (fallbackErr) {
      console.error(`[LOGGER FALLBACK ERROR]: ${message}`, error);
    }
  },

  debug(message: string, meta: Record<string, any> = {}, operation?: string) {
    try {
      const traceMeta = getTraceMetadata();
      const sanitizedMeta = sanitizeObject(meta);
      basePino.debug({
        ...traceMeta,
        ...(operation ? { operation } : {}),
        ...sanitizedMeta,
        message: sanitizeString(message),
      });
    } catch (fallbackErr) {
      console.debug(`[LOGGER FALLBACK DEBUG]: ${message}`);
    }
  },

  http(req: { method: string; url: string; headers?: any }, status: number, durationMs: number, meta: Record<string, any> = {}) {
    try {
      const traceMeta = getTraceMetadata();
      const sanitizedMeta = sanitizeObject(meta);

      const parsedUrl = new URL(req.url, 'http://localhost');
      const cleanUrl = parsedUrl.pathname;

      basePino.info({
        ...traceMeta,
        service: 'http_api',
        operation: `${req.method} ${cleanUrl}`,
        http: {
          method: req.method,
          url: cleanUrl,
          status,
          duration_ms: Math.round(durationMs * 100) / 100,
        },
        ...sanitizedMeta,
        message: `HTTP ${req.method} ${cleanUrl} - ${status} (${Math.round(durationMs)}ms)`,
      });
    } catch (fallbackErr) {
      console.log(`[LOGGER FALLBACK HTTP]: ${req.method} ${req.url} - ${status}`);
    }
  },
};

// Graceful Shutdown Registration
const handleShutdown = (signal: string) => {
  try {
    logger.info(`Received ${signal}. Flushing logger streams...`, {}, 'process_shutdown');
    basePino.flush();
  } catch (_) {}
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
