import { NextResponse } from 'next/server';
import { DB } from '@/lib/db';
import { WhatsAppManager } from '@/lib/whatsapp';

export async function GET() {
  const orders = DB.getOrders();
  return NextResponse.json(orders);
}

export async function PATCH(req: Request) {
  try {
    const { id, status, notes, customerName } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    const order = DB.getOrders().find(o => o.id === id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const updates: any = {};
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (customerName) updates.customerName = customerName;

    DB.updateOrder(id, updates);

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

export async function POST(req: Request) {
  try {
    const { id, phone } = await req.json();
    if (!id || !phone) {
      return NextResponse.json({ error: 'Missing id or phone' }, { status: 400 });
    }

    const { generateContextualFollowUp } = await import('@/lib/ai-handler');
    const prompt = "Summarize key discussion points, client requests, budget, appointment goals, or order specifications from our recent conversation in 2-3 bullet points.";
    const summary = await generateContextualFollowUp(phone, prompt);

    DB.updateOrder(id, { notes: summary });
    return NextResponse.json({ success: true, notes: summary });
  } catch (err: any) {
    console.error("[Orders API] Failed to generate AI summary:", err);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
