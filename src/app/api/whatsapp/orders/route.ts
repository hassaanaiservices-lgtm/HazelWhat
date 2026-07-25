import { NextResponse } from 'next/server';
import { DB } from '@/lib/db';
import { WhatsAppManager } from '@/lib/whatsapp';

export async function GET() {
  const orders = DB.getOrders();
  return NextResponse.json(orders);
}

export async function PATCH(req: Request) {
  try {
    const { id, status } = await req.json();
    if (!id || !status) {
      return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
    }
    const order = DB.getOrders().find(o => o.id === id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const success = DB.updateOrderStatus(id, status);
    if (success) {
      if (status === 'confirmed') {
        const msg = `Your order for *${order.productName}* has been confirmed! We'll begin processing it now.`;
        await WhatsAppManager.sendMessage(order.phone, msg);
      } else if (status === 'cancelled') {
        const msg = `We're sorry, your order for *${order.productName}* could not be processed. Please contact us for more details.`;
        await WhatsAppManager.sendMessage(order.phone, msg);
      }
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
