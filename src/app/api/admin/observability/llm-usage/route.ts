import { requireAdminSession } from "@/lib/auth-session";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/observability/llm-usage
 * Aggregates LLM usage for the central admin dashboard.
 * Supports filtering by tenant_id, provider, model, from, and to dates.
 * Admin authorization required.
 */
export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabase) {
    return NextResponse.json({
      success: true,
      aggregates: [],
      totals: {
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        estimatedCost: 0
      }
    });
  }

  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const provider = searchParams.get('provider');
    const model = searchParams.get('model');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Build query to fetch individual records within scope
    let query = supabase
      .from('llm_usage_logs')
      .select('provider, model, input_tokens, output_tokens, cached_tokens, estimated_cost, tenant_id, created_at')
      .order('created_at', { ascending: false });

    if (tenantId) query = query.eq('tenant_id', tenantId);
    if (provider) query = query.eq('provider', provider);
    if (model) query = query.eq('model', model);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    // Limit to prevent loading excessive rows. Let's load up to 2000 rows for aggregation.
    // If there's high volume, we only aggregate the most recent 2000 matches.
    const { data: logs, error } = await query.limit(2000);
    if (error) throw error;

    // Group in memory for display
    const groups: Record<string, {
      provider: string;
      model: string;
      calls: number;
      inputTokens: number;
      outputTokens: number;
      cachedTokens: number;
      estimatedCost: number;
    }> = {};

    let totalCalls = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCachedTokens = 0;
    let totalCost = 0;

    for (const log of logs || []) {
      const key = `${log.provider || 'unknown'}:${log.model || 'unknown'}`;
      if (!groups[key]) {
        groups[key] = {
          provider: log.provider || 'unknown',
          model: log.model || 'unknown',
          calls: 0,
          inputTokens: 0,
          outputTokens: 0,
          cachedTokens: 0,
          estimatedCost: 0
        };
      }

      const input = log.input_tokens || 0;
      const output = log.output_tokens || 0;
      const cached = log.cached_tokens || 0;
      const cost = Number(log.estimated_cost) || 0;

      groups[key].calls++;
      groups[key].inputTokens += input;
      groups[key].outputTokens += output;
      groups[key].cachedTokens += cached;
      groups[key].estimatedCost += cost;

      totalCalls++;
      totalInputTokens += input;
      totalOutputTokens += output;
      totalCachedTokens += cached;
      totalCost += cost;
    }

    return NextResponse.json({
      success: true,
      aggregates: Object.values(groups),
      totals: {
        calls: totalCalls,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        cachedTokens: totalCachedTokens,
        estimatedCost: totalCost
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
