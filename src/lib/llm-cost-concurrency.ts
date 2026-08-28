import pino from "pino";
import { getRedisClient } from "./redis";
import { getTenantLLMUsage } from "./observability-store";

const logger = pino({ name: "llm-cost-concurrency" });

// Global & Per-Tenant Concurrency Limits
export const MAX_GLOBAL_LLM_CONCURRENCY = parseInt(process.env.MAX_GLOBAL_LLM_CONCURRENCY || "30", 10);
export const MAX_TENANT_LLM_CONCURRENCY = parseInt(process.env.MAX_TENANT_LLM_CONCURRENCY || "15", 10);

// Default Cost Protection Caps
export const DEFAULT_DAILY_TENANT_BUDGET_USD = parseFloat(process.env.DEFAULT_DAILY_TENANT_BUDGET_USD || "5.00");
export const DEFAULT_MAX_TOKENS_PER_MINUTE = parseInt(process.env.DEFAULT_MAX_TOKENS_PER_MINUTE || "50000", 10);
export const MAX_LLM_RESPONSE_TOKENS = 400;
export const MAX_CONTEXT_INPUT_TOKENS = 3000;

// Local In-Memory Fallbacks (Used during testing or Redis degradation)
let activeGlobalSlots = 0;
const activeTenantSlots = new Map<string, number>();
const inMemoryDailyCost = new Map<string, number>();
const inMemoryCache = new Map<string, { response: any; expiresAt: number }>();

export interface LLMSlotHandle {
  acquired: boolean;
  tenantId: string;
  provider: string;
  reason?: "acquired" | "global_concurrency_exceeded" | "tenant_concurrency_exceeded" | "budget_exceeded" | "rate_limit_exceeded";
  release: () => Promise<void>;
}

/**
 * Pre-flight Budget Guard: Verifies if tenant has remaining daily USD quota.
 */
export async function checkTenantDailyBudget(
  tenantId: string,
  customBudgetUsd?: number
): Promise<{ allowed: boolean; currentCostUsd: number; budgetUsd: number }> {
  const budgetUsd = customBudgetUsd !== undefined ? customBudgetUsd : DEFAULT_DAILY_TENANT_BUDGET_USD;
  const todayKey = new Date().toISOString().substring(0, 10); // YYYY-MM-DD
  const redisKey = `llm:cost:tenant:${tenantId}:${todayKey}`;

  let currentCostUsd = 0;
  const redis = getRedisClient();

  if (redis) {
    try {
      const val = await redis.get(redisKey);
      if (val) {
        currentCostUsd = parseFloat(val);
      }
    } catch (err: any) {
      logger.warn({ event: "redis_budget_check_error", error: err.message, tenantId });
    }
  } else {
    currentCostUsd = inMemoryDailyCost.get(`${tenantId}:${todayKey}`) || 0;
  }

  // Fallback to database aggregate if zero
  if (currentCostUsd === 0) {
    try {
      const usages = await getTenantLLMUsage(tenantId);
      const startOfDay = new Date(`${todayKey}T00:00:00.000Z`).getTime();
      currentCostUsd = usages
        .filter((u) => new Date(u.createdAt || "").getTime() >= startOfDay)
        .reduce((acc, curr) => acc + (curr.estimatedCost || 0), 0);
    } catch (_) {}
  }

  const allowed = currentCostUsd < budgetUsd;
  return { allowed, currentCostUsd, budgetUsd };
}

/**
 * Atomic Concurrency Control: Acquire an execution slot for an LLM provider call.
 */
export async function acquireLLMConcurrencySlot(
  tenantId: string,
  provider: string,
  customBudgetUsd?: number
): Promise<LLMSlotHandle> {
  // 1. Budget Guard Check
  const budgetCheck = await checkTenantDailyBudget(tenantId, customBudgetUsd);
  if (!budgetCheck.allowed) {
    logger.warn({
      event: "llm_budget_exceeded",
      tenant_id: tenantId,
      provider,
      current_cost: budgetCheck.currentCostUsd,
      budget_usd: budgetCheck.budgetUsd,
    });
    return {
      acquired: false,
      tenantId,
      provider,
      reason: "budget_exceeded",
      release: async () => {},
    };
  }

  // 2. Concurrency Semaphore Check
  const redis = getRedisClient();
  const globalKey = "llm:sem:global";
  const tenantKey = `llm:sem:tenant:${tenantId}`;

  let acquiredGlobal = false;
  let acquiredTenant = false;

  if (redis) {
    try {
      // Global semaphore
      const currentGlobal = await redis.incr(globalKey);
      await redis.expire(globalKey, 60);

      if (currentGlobal > MAX_GLOBAL_LLM_CONCURRENCY) {
        await redis.decr(globalKey);
        logger.warn({ event: "global_llm_concurrency_exceeded", currentGlobal, max: MAX_GLOBAL_LLM_CONCURRENCY });
        return {
          acquired: false,
          tenantId,
          provider,
          reason: "global_concurrency_exceeded",
          release: async () => {},
        };
      }
      acquiredGlobal = true;

      // Tenant semaphore
      const currentTenant = await redis.incr(tenantKey);
      await redis.expire(tenantKey, 60);

      if (currentTenant > MAX_TENANT_LLM_CONCURRENCY) {
        await redis.decr(tenantKey);
        await redis.decr(globalKey);
        logger.warn({ event: "tenant_llm_concurrency_exceeded", tenantId, currentTenant, max: MAX_TENANT_LLM_CONCURRENCY });
        return {
          acquired: false,
          tenantId,
          provider,
          reason: "tenant_concurrency_exceeded",
          release: async () => {},
        };
      }
      acquiredTenant = true;
    } catch (err: any) {
      logger.warn({ event: "redis_semaphore_fallback", error: err.message });
      // In-memory fallback
      if (activeGlobalSlots >= MAX_GLOBAL_LLM_CONCURRENCY) {
        return { acquired: false, tenantId, provider, reason: "global_concurrency_exceeded", release: async () => {} };
      }
      const tCount = activeTenantSlots.get(tenantId) || 0;
      if (tCount >= MAX_TENANT_LLM_CONCURRENCY) {
        return { acquired: false, tenantId, provider, reason: "tenant_concurrency_exceeded", release: async () => {} };
      }
      activeGlobalSlots++;
      activeTenantSlots.set(tenantId, tCount + 1);
    }
  } else {
    // Pure In-Memory Path
    if (activeGlobalSlots >= MAX_GLOBAL_LLM_CONCURRENCY) {
      return { acquired: false, tenantId, provider, reason: "global_concurrency_exceeded", release: async () => {} };
    }
    const tCount = activeTenantSlots.get(tenantId) || 0;
    if (tCount >= MAX_TENANT_LLM_CONCURRENCY) {
      return { acquired: false, tenantId, provider, reason: "tenant_concurrency_exceeded", release: async () => {} };
    }
    activeGlobalSlots++;
    activeTenantSlots.set(tenantId, tCount + 1);
  }

  let released = false;
  const release = async () => {
    if (released) return;
    released = true;

    if (redis) {
      try {
        if (acquiredGlobal) await redis.decr(globalKey);
        if (acquiredTenant) await redis.decr(tenantKey);
      } catch (_) {}
    }

    activeGlobalSlots = Math.max(0, activeGlobalSlots - 1);
    const count = activeTenantSlots.get(tenantId) || 0;
    if (count <= 1) {
      activeTenantSlots.delete(tenantId);
    } else {
      activeTenantSlots.set(tenantId, count - 1);
    }
  };

  return {
    acquired: true,
    tenantId,
    provider,
    reason: "acquired",
    release,
  };
}

/**
 * Record cost incurred by an LLM call to update tenant daily spending.
 */
export async function recordTenantLLMCost(tenantId: string, costUsd: number): Promise<number> {
  if (costUsd <= 0) return 0;
  const todayKey = new Date().toISOString().substring(0, 10);
  const redisKey = `llm:cost:tenant:${tenantId}:${todayKey}`;

  let totalCost = costUsd;
  const redis = getRedisClient();

  if (redis) {
    try {
      const newTotalStr = await redis.incrbyfloat(redisKey, costUsd);
      await redis.expire(redisKey, 172800); // 48 hours TTL
      totalCost = parseFloat(newTotalStr);
    } catch (_) {
      const current = inMemoryDailyCost.get(`${tenantId}:${todayKey}`) || 0;
      totalCost = current + costUsd;
      inMemoryDailyCost.set(`${tenantId}:${todayKey}`, totalCost);
    }
  } else {
    const current = inMemoryDailyCost.get(`${tenantId}:${todayKey}`) || 0;
    totalCost = current + costUsd;
    inMemoryDailyCost.set(`${tenantId}:${todayKey}`, totalCost);
  }

  logger.info({
    event: "llm_cost_recorded",
    tenant_id: tenantId,
    added_cost_usd: costUsd,
    total_daily_cost_usd: totalCost,
  });

  return totalCost;
}

/**
 * Context Window Protection: Truncate messages to prevent infinite token growth.
 */
export function truncateContextWindow(
  messages: any[],
  maxTokens: number = MAX_CONTEXT_INPUT_TOKENS,
  maxMessages: number = 10
): any[] {
  if (!messages || messages.length === 0) return [];

  // Always retain system message if present
  let systemMsg: any = null;
  let chatMsgs = [...messages];

  if (chatMsgs[0]?.role === "system") {
    systemMsg = chatMsgs.shift();
  }

  // Cap message count
  if (chatMsgs.length > maxMessages) {
    chatMsgs = chatMsgs.slice(chatMsgs.length - maxMessages);
  }

  // Truncate based on character length estimation (4 chars ~ 1 token)
  const maxChars = maxTokens * 4;
  let currentChars = 0;
  const trimmed: any[] = [];

  for (let i = chatMsgs.length - 1; i >= 0; i--) {
    const msg = chatMsgs[i];
    let len = 0;

    if (typeof msg.content === "string") {
      len = msg.content.length;
    } else if (Array.isArray(msg.content)) {
      len = JSON.stringify(msg.content).length;
    }

    if (currentChars + len > maxChars && trimmed.length > 0) {
      break;
    }

    currentChars += len;
    trimmed.unshift(msg);
  }

  if (systemMsg) {
    trimmed.unshift(systemMsg);
  }

  return trimmed;
}

/**
 * Short Window Prompt Response Caching (Deduplication).
 */
export async function getCachedLLMResponse(
  tenantId: string,
  promptHash: string
): Promise<any | null> {
  const cacheKey = `llm:cache:${tenantId}:${promptHash}`;
  const redis = getRedisClient();

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (_) {}
  } else {
    const item = inMemoryCache.get(cacheKey);
    if (item && item.expiresAt > Date.now()) {
      return item.response;
    }
  }
  return null;
}

export async function setCachedLLMResponse(
  tenantId: string,
  promptHash: string,
  response: any,
  ttlSeconds: number = 30
): Promise<void> {
  const cacheKey = `llm:cache:${tenantId}:${promptHash}`;
  const redis = getRedisClient();

  if (redis) {
    try {
      await redis.set(cacheKey, JSON.stringify(response), "EX", ttlSeconds);
    } catch (_) {}
  } else {
    inMemoryCache.set(cacheKey, {
      response,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }
}

/**
 * Operational Metrics API Helper.
 */
export function getLLMCostConcurrencyMetrics() {
  return {
    maxGlobalConcurrency: MAX_GLOBAL_LLM_CONCURRENCY,
    maxTenantConcurrency: MAX_TENANT_LLM_CONCURRENCY,
    defaultDailyBudgetUsd: DEFAULT_DAILY_TENANT_BUDGET_USD,
    activeGlobalSlots,
    activeTenantsCount: activeTenantSlots.size,
  };
}
