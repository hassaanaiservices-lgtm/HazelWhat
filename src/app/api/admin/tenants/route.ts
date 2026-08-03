import { NextRequest, NextResponse } from "next/server";
import { DB } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenants = DB.getTenants();
    const partners = DB.getPartners();
    return NextResponse.json({ success: true, tenants, partners });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (Array.isArray(body.tenants)) {
      DB.saveTenants(body.tenants);
    }
    if (Array.isArray(body.partners)) {
      DB.savePartners(body.partners);
    }
    return NextResponse.json({ 
      success: true, 
      tenants: DB.getTenants(), 
      partners: DB.getPartners() 
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
