import { NextRequest, NextResponse } from 'next/server';
import { WhatsAppManager } from '@/lib/whatsapp';
import { requireTenantSession } from '@/lib/auth-session';

export async function GET(req: NextRequest) {
  try {
    const session = await requireTenantSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const to = searchParams.get('to') || "923236349759"; // Use user's number from DB
    
    await WhatsAppManager.sendProductCarousel(to, [
      {
        title: "Test Dress",
        price: "Rs 15000",
        image: "https://cutecoodle.com/cdn/shop/files/IMG_2837_JPG.jpg",
        link: "https://cutecoodle.com"
      }
    ]);
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.toString(), stack: err.stack });
  }
}
