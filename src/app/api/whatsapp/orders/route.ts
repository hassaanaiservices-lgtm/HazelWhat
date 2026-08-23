import { NextRequest, NextResponse } from 'next/server';
import { DB } from '@/lib/db';
import { WhatsAppManager } from '@/lib/whatsapp';
import { getSessionFromCookies } from "@/lib/auth-session";
import { withObservability } from '@/lib/with-observability';
import { updateTraceContext } from '@/lib/trace-context';

export const GET = withObservability(async (req: NextRequest) => {
  const session = await getSessionFromCookies(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let effectiveTenantId = session?.tenantId;
  if (session?.role === 'admin') {
    const queryTenantId = req.nextUrl.searchParams.get('tenantId');
    if (queryTenantId && queryTenantId !== 'admin') {
      effectiveTenantId = queryTenantId;
    }
  }

  if (!effectiveTenantId || effectiveTenantId === 'admin') {
    const activeFromSock = await WhatsAppManager.resolveActiveTenantFromSocket();
    effectiveTenantId = activeFromSock || WhatsAppManager.getActiveTenantId() || 't-1007';
  }

  updateTraceContext({ tenantId: effectiveTenantId });

    let orders = await DB.getOrders(effectiveTenantId);

    // Resilient Fallback: Merge orders from active socket tenant if different
    const activeFromSock = await WhatsAppManager.resolveActiveTenantFromSocket();
    if (activeFromSock && activeFromSock !== effectiveTenantId) {
      const sockOrders = await DB.getOrders(activeFromSock);
      if (sockOrders.length > 0) {
        const orderMap = new Map();
        [...orders, ...sockOrders].forEach(o => orderMap.set(o.id, o));
        orders = Array.from(orderMap.values());
      }
    }

    if (effectiveTenantId === 't-1007' && orders.length === 0) {
      await DB.addOrder("923337778899", {
        productName: "UI/UX Brand Design & System Package",
        price: "PKR 45,000",
        paymentMethod: "Bank Transfer",
        deliveryAddress: "Office 12, Main Boulevard, Gulberg, Lahore",
        customerName: "Sarah Khan"
      }, 't-1007');

      await DB.addOrder("923001112233", {
        productName: "AI WhatsApp Chatbot & Automation Suite",
        price: "PKR 85,000",
        paymentMethod: "JazzCash",
        deliveryAddress: "DHA Phase 5, Lahore",
        customerName: "Ali Raza"
      }, 't-1007');

      orders = await DB.getOrders(effectiveTenantId);
    }
    return NextResponse.json(orders);
});

export const PATCH = withObservability(async (req: NextRequest) => {
  const session = await getSessionFromCookies(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  updateTraceContext({ tenantId: session.tenantId });

  const { id, status, notes, customerName } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  let orders;
  let targetTenantId = session.tenantId;
  if (session.role === 'admin') {
    orders = await DB.getOrdersAdminAllTenants();
    const match = orders.find(o => o.id === id);
    if (match?.tenantId) targetTenantId = match.tenantId;
  } else {
    orders = await DB.getOrders(session.tenantId);
  }

  const order = orders.find(o => o.id === id);
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const updates: any = {};
  if (status) {
    updates.status = status === 'completed' ? 'delivered' : status;
  }
  if (notes !== undefined) updates.notes = notes;
  if (customerName) updates.customerName = customerName;

  await DB.updateOrder(id, updates, targetTenantId);

  if (status && status !== order.status) {
    if (status === 'confirmed') {
      const msg = `Your order/booking for *${order.productName}* has been confirmed! We'll begin processing it now.`;
      await WhatsAppManager.sendMessage(order.phone, msg);
    } else if (status === 'cancelled') {
      const msg = `We're sorry, your order/booking for *${order.productName}* could not be processed. Please contact us for more details.`;
      await WhatsAppManager.sendMessage(order.phone, msg);
    }
  }
  return NextResponse.json({ success: true });
});

export const POST = withObservability(async (req: NextRequest) => {
  const session = await getSessionFromCookies(req);
  const tenantId = session?.tenantId;
  if (tenantId) updateTraceContext({ tenantId });

  const { id, phone } = await req.json();
  if (!id || !phone) {
    return NextResponse.json({ error: 'Missing id or phone' }, { status: 400 });
  }

  const { generateContextualFollowUp } = await import('@/lib/ai-handler');
  const prompt = "Summarize key discussion points, client requests, budget, appointment goals, or order specifications from our recent conversation in 2-3 bullet points.";
  const summary = await generateContextualFollowUp(phone, prompt, tenantId);

  await DB.updateOrder(id, { notes: summary }, tenantId);
  return NextResponse.json({ success: true, notes: summary });
});
