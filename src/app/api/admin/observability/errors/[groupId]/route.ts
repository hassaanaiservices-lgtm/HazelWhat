import { requireAdminSession } from "@/lib/auth-session";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/observability/errors/[groupId]
 * Returns full detail of one error group including individual occurrences.
 * Always admin-only. Never exposes unsanitized original_message.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await requireAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { groupId } = await params;
  if (!groupId) {
    return NextResponse.json({ error: "Missing groupId" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const occLimit  = Math.min(200, parseInt(searchParams.get('occLimit') || '50'));
  const occOffset = parseInt(searchParams.get('occOffset') || '0');
  const tenantFilter = searchParams.get('tenantId');

  try {
    // 1. Fetch the error group
    const { data: group, error: groupErr } = await supabase
      .from('error_groups')
      .select(`
        id, fingerprint, title, service, operation, error_code, severity, status,
        occurrence_count, affected_tenant_count, first_seen_at, last_seen_at,
        created_at, resolved_at, resolved_by
      `)
      .eq('id', groupId)
      .single();

    if (groupErr || !group) {
      return NextResponse.json({ error: "Error group not found" }, { status: 404 });
    }

    // 2. Fetch individual occurrences (paginated)
    let occQuery = supabase
      .from('app_errors')
      .select(`
        id, tenant_id, request_id, trace_id, correlation_id, service, operation,
        error_code, error_name, normalized_message, severity, status, stack_trace,
        provider, model, metadata, created_at
      `, { count: 'exact' })
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .range(occOffset, occOffset + occLimit - 1);

    if (tenantFilter) {
      occQuery = occQuery.eq('tenant_id', tenantFilter);
    }

    const { data: occurrences, count: occTotal, error: occErr } = await occQuery;
    if (occErr) throw occErr;

    // 3. Distinct tenant list (bounded to 50 for UI — just for display)
    const { data: tenantRows } = await supabase
      .from('app_errors')
      .select('tenant_id')
      .eq('group_id', groupId)
      .limit(50);

    const distinctTenants = [...new Set((tenantRows || []).map((r: any) => r.tenant_id).filter(Boolean))];

    // 4. LLM usage for this request scope (find by request_ids that appear in occurrences)
    const requestIds = [...new Set((occurrences || []).map((o: any) => o.request_id).filter(Boolean))].slice(0, 20);
    let relatedLLMUsage: any[] = [];
    if (requestIds.length > 0) {
      const { data: llmData } = await supabase
        .from('llm_usage_logs')
        .select('id, tenant_id, request_id, provider, model, input_tokens, output_tokens, estimated_cost, latency_ms, created_at')
        .in('request_id', requestIds)
        .limit(100);
      relatedLLMUsage = llmData || [];
    }

    return NextResponse.json({
      success: true,
      group: {
        id: group.id,
        fingerprint: group.fingerprint,
        title: group.title,
        service: group.service,
        operation: group.operation,
        errorCode: group.error_code,
        severity: group.severity,
        status: group.status,
        occurrenceCount: group.occurrence_count,
        affectedTenantCount: group.affected_tenant_count,
        firstSeenAt: group.first_seen_at,
        lastSeenAt: group.last_seen_at,
        resolvedAt: group.resolved_at,
        resolvedBy: group.resolved_by,
      },
      occurrences: (occurrences || []).map((o: any) => ({
        id: o.id,
        tenantId: o.tenant_id,
        requestId: o.request_id,
        traceId: o.trace_id,
        correlationId: o.correlation_id,
        service: o.service,
        operation: o.operation,
        errorCode: o.error_code,
        errorName: o.error_name,
        normalizedMessage: o.normalized_message,
        severity: o.severity,
        status: o.status,
        stackTrace: o.stack_trace,
        provider: o.provider,
        model: o.model,
        metadata: o.metadata,
        createdAt: o.created_at,
      })),
      occTotal: occTotal || 0,
      distinctTenants,
      relatedLLMUsage: relatedLLMUsage.map((u: any) => ({
        id: u.id,
        tenantId: u.tenant_id,
        requestId: u.request_id,
        provider: u.provider,
        model: u.model,
        inputTokens: u.input_tokens,
        outputTokens: u.output_tokens,
        estimatedCost: Number(u.estimated_cost),
        latencyMs: u.latency_ms,
        createdAt: u.created_at,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
