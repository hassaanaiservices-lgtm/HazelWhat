import { NextRequest, NextResponse } from "next/server";
import { DB } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenants = await DB.getTenants();
    const partners = await DB.getPartners();
    return NextResponse.json({ success: true, tenants, partners });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (Array.isArray(body.tenants)) {
      await DB.saveTenantsAsync(body.tenants);
    }
    if (Array.isArray(body.partners)) {
      await DB.savePartners(body.partners);
    }
    return NextResponse.json({ 
      success: true, 
      tenants: await DB.getTenants(), 
      partners: await DB.getPartners() 
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId } = body;
    if (!tenantId) {
      return NextResponse.json({ success: false, error: "Missing tenantId" }, { status: 400 });
    }
    await DB.deleteTenant(tenantId);
    return NextResponse.json({ 
      success: true, 
      tenants: await DB.getTenants(), 
      partners: await DB.getPartners() 
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
