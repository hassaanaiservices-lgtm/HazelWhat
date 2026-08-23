import { requireAdminSession } from "@/lib/auth-session";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  type: 'WHATSAPP_MESSAGE' | 'TOOL_EXECUTION' | 'STT_TRANSCRIPTION' | 'API_ALERT' | 'ORDER_CREATED' | 'SYSTEM';
  level: 'info' | 'warn' | 'error' | 'success';
  phone?: string;
  tenantId?: string;
  businessName?: string;
  summary: string;
  details?: Record<string, any>;
  query?: string;
  response?: string;
  latencyMs?: number;
  model?: string;
}

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const tenantFilter = searchParams.get('tenantId') || 'all';
    const typeFilter = searchParams.get('type') || 'all';
    const levelFilter = searchParams.get('level') || 'all';
    const limit = parseInt(searchParams.get('limit') || '200');

    // 1. Fetch Tenants for Name Mapping
    const { data: tenants } = await supabase.from('tenant_configs').select('id, name, business_name');
    const tenantMap = new Map<string, string>();
    (tenants || []).forEach((t: any) => {
      tenantMap.set(t.id, t.business_name || t.name || t.id);
    });

    // 2. Fetch Chat Messages (Requests & AI Replies)
    let msgQuery = supabase
      .from('chat_messages')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (tenantFilter !== 'all') {
      msgQuery = msgQuery.eq('tenant_id', tenantFilter);
    }

    const { data: messages } = await msgQuery;

    // 3. Fetch Orders
    let orderQuery = supabase
      .from('orders')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50);

    if (tenantFilter !== 'all') {
      orderQuery = orderQuery.eq('tenant_id', tenantFilter);
    }

    const { data: orders } = await orderQuery;

    // 4. Fetch API Alerts
    const { data: apiAlerts } = await supabase
      .from('api_alerts')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50);

    const logEntries: SystemLogEntry[] = [];

    // Process Chat Messages into Structured Logs
    (messages || []).forEach((msg: any) => {
      const isUser = msg.role === 'user';
      const isAssistant = msg.role === 'assistant';
      const isTool = msg.role === 'tool';
      const businessName = tenantMap.get(msg.tenant_id) || msg.tenant_id || 'System';

      let type: SystemLogEntry['type'] = 'WHATSAPP_MESSAGE';
      let level: SystemLogEntry['level'] = 'info';

      if (isTool || (msg.content && msg.content.includes('place_order'))) {
        type = 'TOOL_EXECUTION';
        level = 'success';
      } else if (msg.content && (msg.content.includes('[Audio Note]') || msg.content.includes('Voice Note'))) {
        type = 'STT_TRANSCRIPTION';
      }

      logEntries.push({
        id: `msg-${msg.id}`,
        timestamp: msg.timestamp || new Date().toISOString(),
        type,
        level,
        phone: msg.phone || msg.from,
        tenantId: msg.tenant_id,
        businessName,
        summary: `[${msg.role?.toUpperCase() || 'CHAT'}] ${isUser ? 'Incoming Customer Message' : isAssistant ? 'AI Agent Reply' : 'Tool Action Execution'}`,
        query: isUser ? msg.content : undefined,
        response: isAssistant ? msg.content : undefined,
        details: {
          role: msg.role,
          content: msg.content,
          rawMessage: msg
        }
      });
    });

    // Process Orders into Structured Logs
    (orders || []).forEach((ord: any) => {
      const businessName = tenantMap.get(ord.tenant_id) || ord.tenant_id || 'System';
      logEntries.push({
        id: `ord-${ord.id}`,
        timestamp: ord.timestamp || ord.created_at || new Date().toISOString(),
        type: 'ORDER_CREATED',
        level: 'success',
        phone: ord.phone,
        tenantId: ord.tenant_id,
        businessName,
        summary: `📦 ORDER CAPTURED: 1x ${ord.product_name || ord.productName} for ${ord.customer_name || ord.customerName || ord.phone}`,
        details: {
          productName: ord.product_name || ord.productName,
          price: ord.price,
          deliveryAddress: ord.delivery_address || ord.deliveryAddress,
          status: ord.status,
          orderId: ord.id
        }
      });
    });

    // Process API Alerts into Structured Logs
    (apiAlerts || []).forEach((alt: any) => {
      let level: SystemLogEntry['level'] = 'warn';
      if (alt.type === 'invalid_key' || alt.type === 'quota_exceeded' || alt.type === 'circuit_open') {
        level = 'error';
      }

      logEntries.push({
        id: `alt-${alt.id}`,
        timestamp: alt.timestamp || new Date().toISOString(),
        type: 'API_ALERT',
        level,
        summary: `🚨 API ALERT: [${alt.service || 'System'}] ${alt.message}`,
        details: {
          service: alt.service,
          type: alt.type,
          message: alt.message
        }
      });
    });

    // Sort all combined logs by timestamp descending
    logEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply Type & Level Filters
    let filteredLogs = logEntries;

    if (typeFilter !== 'all') {
      filteredLogs = filteredLogs.filter(l => l.type === typeFilter);
    }
    if (levelFilter !== 'all') {
      filteredLogs = filteredLogs.filter(l => l.level === levelFilter);
    }

    return NextResponse.json({
      success: true,
      total: filteredLogs.length,
      logs: filteredLogs.slice(0, limit),
      filters: {
        tenantId: tenantFilter,
        type: typeFilter,
        level: levelFilter
      }
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
