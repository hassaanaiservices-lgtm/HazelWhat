import { NextRequest, NextResponse } from "next/server";
import { DB } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let tenants = DB.getTenants();
    const partners = DB.getPartners();

    // If local tenants array is empty or wiped after deployment, attempt to restore from Supabase
    if (!tenants || tenants.length === 0) {
      try {
        const { fetchTenantsFromSupabase } = await import("@/lib/supabase");
        const supabaseTenants = await fetchTenantsFromSupabase();
        if (supabaseTenants && supabaseTenants.length > 0) {
          console.log(`[Tenants API] Restored ${supabaseTenants.length} tenant(s) from Supabase persistence.`);
          DB.saveTenants(supabaseTenants);
          tenants = supabaseTenants;
        }
      } catch (e) {
        console.error('[Tenants API] Error restoring from Supabase:', e);
      }
    }

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
