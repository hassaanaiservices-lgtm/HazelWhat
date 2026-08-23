import { requireAdminSession } from "@/lib/auth-session";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/observability/errors
 * Returns paginated, filtered error groups with occurrence totals.
 * All filtering is enforced server-side. Never exposes raw PII.
 */
export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Guard: DB must be configured
  if (!supabase) {
    return NextResponse.json({
      success: true,
      groups: [],
      total: 0,
      note: "Database not configured — observability data unavailable"
    });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page     = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit    = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset   = (page - 1) * limit;

    // Filters
    const status    = searchParams.get('status');    // NEW|ACKNOWLEDGED|INVESTIGATING|RESOLVED|IGNORED
    const severity  = searchParams.get('severity');  // critical|high|medium|low
    const service   = searchParams.get('service');
    const operation = searchParams.get('operation');
    const search    = searchParams.get('search');    // fingerprint, errorCode, normalizedMessage
    const from      = searchParams.get('from');      // ISO date
    const to        = searchParams.get('to');        // ISO date

    let query = supabase
      .from('error_groups')
      .select(`
        id, fingerprint, title, service, operation, error_code, severity, status,
        occurrence_count, affected_tenant_count, first_seen_at, last_seen_at,
        created_at, resolved_at, resolved_by
      `, { count: 'exact' })
      .order('last_seen_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (severity) query = query.eq('severity', severity);
    if (service) query = query.eq('service', service);
    if (operation) query = query.eq('operation', operation);
    if (from) query = query.gte('last_seen_at', from);
    if (to) query = query.lte('last_seen_at', to);
    if (search) {
      query = query.or(
        `fingerprint.ilike.%${search}%,title.ilike.%${search}%,error_code.ilike.%${search}%`
      );
    }

    const { data, count, error } = await query;
    if (error) throw error;

    const groups = (data || []).map((g: any) => ({
      id: g.id,
      fingerprint: g.fingerprint,
      title: g.title,
      service: g.service,
      operation: g.operation,
      errorCode: g.error_code,
      severity: g.severity,
      status: g.status,
      occurrenceCount: g.occurrence_count,
      affectedTenantCount: g.affected_tenant_count,
      firstSeenAt: g.first_seen_at,
      lastSeenAt: g.last_seen_at,
      resolvedAt: g.resolved_at,
      resolvedBy: g.resolved_by,
    }));

    return NextResponse.json({ success: true, groups, total: count || 0, page, limit });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/observability/errors
 * Updates error group status (lifecycle transition).
 * Body: { groupId, status, resolvedBy? }
 */
export async function PATCH(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { groupId, status, resolvedBy } = body;

    const VALID_STATUSES = ['NEW', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'IGNORED'];
    if (!groupId || !status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid groupId or status" }, { status: 400 });
    }

    const update: any = { status };
    if (status === 'RESOLVED') {
      update.resolved_at = new Date().toISOString();
      update.resolved_by = resolvedBy || 'admin';
    } else {
      update.resolved_at = null;
      update.resolved_by = null;
    }

    const { data, error } = await supabase
      .from('error_groups')
      .update(update)
      .eq('id', groupId)
      .select('id, status, resolved_at, resolved_by')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, group: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
