import { requireAdminSession } from "@/lib/auth-session";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { WhatsAppManager } from "@/lib/whatsapp";
import { getQueueMetrics, getQueueLength } from "@/lib/queue-manager";
import { getAllCircuitStatuses } from "@/lib/ai-handler";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/observability/metrics
 * Returns unified database-backed observability metrics for the central admin dashboard.
 * Complies with the truthfulness rule: does not manufacture fake request counts or latency metrics.
 */
export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Bounded timeframe
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from'); // ISO date
  const to = searchParams.get('to');     // ISO date

  if (!supabase) {
    return NextResponse.json({
      success: true,
      metrics: {
        dbConnected: false,
        totalErrors: 0,
        unresolvedErrors: 0,
        errorGroupsCount: 0,
        totalLlmCalls: 0,
        totalLlmInputTokens: 0,
        totalLlmOutputTokens: 0,
        totalLlmCachedTokens: 0,
        totalLlmCost: 0,
        activeTenantsCount: 0,
        requestsByTenant: {},
        errorsByTenant: {},
        llmUsageByTenant: {},
        callsByProvider: {},
        callsByModel: {},
        whatsappSessions: [],
        activeSessionsCount: 0,
        queueMetrics: { isRedisConnected: false, concurrencyLimit: 20, inMemoryQueueLength: 0, activeMemoryWorkers: 0 },
        queueLength: 0,
        circuits: {},
        dbConnectionPoolHealth: "unhealthy",
        rateLimitWarningsPerMin: 0
      },
      notImplemented: [
        "totalRequests",
        "requestsPerMinute",
        "averageRequestLatency",
        "p50RequestLatency",
        "p95RequestLatency",
        "p99RequestLatency",
        "workerQueueHealth"
      ]
    });
  }

  try {
    // 1. Fetch error counts & groups
    let errorsQuery = supabase.from('app_errors').select('id, tenant_id, created_at');
    if (from) errorsQuery = errorsQuery.gte('created_at', from);
    if (to) errorsQuery = errorsQuery.lte('created_at', to);
    const { data: errors, error: errsErr } = await errorsQuery;
    if (errsErr) throw errsErr;

    const totalErrors = errors?.length || 0;

    let groupsQuery = supabase.from('error_groups').select('id, status, last_seen_at');
    if (from) groupsQuery = groupsQuery.gte('last_seen_at', from);
    if (to) groupsQuery = groupsQuery.lte('last_seen_at', to);
    const { data: groups, error: grpsErr } = await groupsQuery;
    if (grpsErr) throw grpsErr;

    const errorGroupsCount = groups?.length || 0;
    const unresolvedErrors = groups?.filter((g: any) =>
      g.status !== 'RESOLVED' && g.status !== 'IGNORED'
    ).length || 0;

    // 2. Fetch LLM usage logs
    let usageQuery = supabase.from('llm_usage_logs').select('id, provider, model, input_tokens, output_tokens, cached_tokens, estimated_cost, tenant_id, latency_ms, created_at');
    if (from) usageQuery = usageQuery.gte('created_at', from);
    if (to) usageQuery = usageQuery.lte('created_at', to);
    const { data: usageLogs, error: usgErr } = await usageQuery;
    if (usgErr) throw usgErr;

    const totalLlmCalls = usageLogs?.length || 0;
    let totalLlmInputTokens = 0;
    let totalLlmOutputTokens = 0;
    let totalLlmCachedTokens = 0;
    let totalLlmCost = 0;
    let totalLlmLatency = 0;
    let successfulLlmLatencyCalls = 0;

    const callsByProvider: Record<string, number> = {};
    const callsByModel: Record<string, number> = {};
    const llmUsageByTenant: Record<string, { calls: number; cost: number }> = {};
    const errorsByTenant: Record<string, number> = {};

    // Group error counts by tenant
    for (const e of errors || []) {
      const tenant = e.tenant_id || 'unknown';
      errorsByTenant[tenant] = (errorsByTenant[tenant] || 0) + 1;
    }

    // Process LLM logs
    for (const log of usageLogs || []) {
      const provider = log.provider || 'unknown';
      const model = log.model || 'unknown';
      const tenant = log.tenant_id || 'unknown';
      const cost = Number(log.estimated_cost) || 0;
      const latency = log.latency_ms || 0;

      totalLlmInputTokens += log.input_tokens || 0;
      totalLlmOutputTokens += log.output_tokens || 0;
      totalLlmCachedTokens += log.cached_tokens || 0;
      totalLlmCost += cost;

      if (latency > 0) {
        totalLlmLatency += latency;
        successfulLlmLatencyCalls++;
      }

      callsByProvider[provider] = (callsByProvider[provider] || 0) + 1;
      callsByModel[model] = (callsByModel[model] || 0) + 1;

      if (!llmUsageByTenant[tenant]) {
        llmUsageByTenant[tenant] = { calls: 0, cost: 0 };
      }
      llmUsageByTenant[tenant].calls++;
      llmUsageByTenant[tenant].cost += cost;
    }

    const avgLlmLatencyMs = successfulLlmLatencyCalls > 0
      ? Math.round(totalLlmLatency / successfulLlmLatencyCalls)
      : 0;

    // 3. Latency Percentiles (P50, P95, P99) for LLM calls (these are real, actual measurements)
    const sortedLatencies = (usageLogs || [])
      .map((l: any) => l.latency_ms || 0)
      .filter((lat: number) => lat > 0)
      .sort((a: number, b: number) => a - b);

    const getPercentile = (arr: number[], pct: number) => {
      if (arr.length === 0) return 0;
      const idx = Math.ceil((pct / 100) * arr.length) - 1;
      return arr[Math.max(0, idx)];
    };

    const p50LlmLatency = getPercentile(sortedLatencies, 50);
    const p95LlmLatency = getPercentile(sortedLatencies, 95);
    const p99LlmLatency = getPercentile(sortedLatencies, 99);

    // 4. Fetch Active Tenants
    const { data: tenants, error: tenantsErr } = await supabase
      .from('tenants')
      .select('id, status');
    if (tenantsErr) throw tenantsErr;

    const activeTenantsCount = tenants?.filter((t: any) => t.status === 'active').length || 0;

    // Scale and Reliability metrics collection
    const queueMetrics = getQueueMetrics();
    const queueLength = await getQueueLength();

    let circuits = {};
    try {
      circuits = getAllCircuitStatuses();
    } catch (_) {}

    const whatsappSessions = WhatsAppManager.getAllSessions();
    const activeSessionsCount = whatsappSessions.filter(s => s.status === 'connected').length;

    let dbConnectionPoolHealth = "healthy";
    try {
      const { error } = await supabase.from('tenants').select('id').limit(1);
      if (error) dbConnectionPoolHealth = "unhealthy";
    } catch (_) {
      dbConnectionPoolHealth = "unhealthy";
    }

    let rateLimitWarningsPerMin = 0;
    try {
      const oneMinAgo = new Date(Date.now() - 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from('app_errors')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneMinAgo)
        .ilike('message', '%RateLimitExceeded%');
      if (!error && count !== null) {
        rateLimitWarningsPerMin = count;
      }
    } catch (_) {}

    return NextResponse.json({
      success: true,
      metrics: {
        dbConnected: true,
        totalErrors,
        unresolvedErrors,
        errorGroupsCount,
        totalLlmCalls,
        totalLlmInputTokens,
        totalLlmOutputTokens,
        totalLlmCachedTokens,
        totalLlmCost,
        avgLlmLatencyMs,
        p50LlmLatency,
        p95LlmLatency,
        p99LlmLatency,
        activeTenantsCount,
        errorsByTenant,
        llmUsageByTenant,
        callsByProvider,
        callsByModel,
        
        // Scale and Reliability metrics
        whatsappSessions,
        activeSessionsCount,
        queueMetrics,
        queueLength,
        circuits,
        dbConnectionPoolHealth,
        rateLimitWarningsPerMin
      },
      notImplemented: {
        totalRequests: "General HTTP API requests are not stored to DB. Unsanitized log metrics are not mapped here.",
        requestsPerMinute: "Real-time query metrics are only available via log drains (Loki/Prometheus) in future phases.",
        averageRequestLatency: "Request-level latency is only written to Pino stdout.",
        p50RequestLatency: "Request-level latency is not recorded in the DB.",
        p95RequestLatency: "Request-level latency is not recorded in the DB.",
        p99RequestLatency: "Request-level latency is not recorded in the DB."
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
