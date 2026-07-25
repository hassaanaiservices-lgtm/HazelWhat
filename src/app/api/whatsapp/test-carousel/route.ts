import { NextResponse } from 'next/server';
import { WhatsAppManager } from '@/lib/whatsapp';

export async function GET(req: Request) {
  try {
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
