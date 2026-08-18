import { NextRequest, NextResponse } from 'next/server';
import { DB } from '@/lib/db';
import { WhatsAppManager } from '@/lib/whatsapp';
import { getSessionFromCookies } from "@/lib/auth-session";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookies(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let orders;
    if (session.role === 'admin') {
      const queryTenantId = req.nextUrl.searchParams.get('tenantId');
      const targetTenantId = queryTenantId && queryTenantId !== 'admin' ? queryTenantId : undefined;
      orders = targetTenantId ? await DB.getOrders(targetTenantId) : await DB.getOrdersAdminAllTenants();
    } else {
      orders = await DB.getOrders(session.tenantId);
      if (session.tenantId === 't-1007' && orders.length === 0) {
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

        orders = await DB.getOrders(session.tenantId);
      }
    }
    return NextResponse.json(orders);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionFromCookies(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    if (status) updates.status = status;
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
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies(req);
    const tenantId = session?.tenantId;

    const { id, phone } = await req.json();
    if (!id || !phone) {
      return NextResponse.json({ error: 'Missing id or phone' }, { status: 400 });
    }

    const { generateContextualFollowUp } = await import('@/lib/ai-handler');
    const prompt = "Summarize key discussion points, client requests, budget, appointment goals, or order specifications from our recent conversation in 2-3 bullet points.";
    const summary = await generateContextualFollowUp(phone, prompt, tenantId);

    await DB.updateOrder(id, { notes: summary }, tenantId);
    return NextResponse.json({ success: true, notes: summary });
  } catch (err: any) {
    console.error("[Orders API] Failed to generate AI summary:", err);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
