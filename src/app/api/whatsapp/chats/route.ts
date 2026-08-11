import { NextRequest, NextResponse } from "next/server";
import { DB } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth-session";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const tag = "[Chats API]";
  try {
    // --- COOKIE DIAGNOSTICS ---
    const allCookies = req.cookies.getAll();
    console.log(`${tag} Incoming cookies:`, allCookies.map(c => `${c.name}=${c.value?.substring(0, 40)}...`));

    const rawClientCookie = req.cookies.get("hazel_client_session")?.value;
    const rawAdminCookie = req.cookies.get("hazel_admin_session")?.value;
    console.log(`${tag} hazel_client_session present:`, !!rawClientCookie);
    console.log(`${tag} hazel_admin_session present:`, !!rawAdminCookie);

    const session = await getSessionFromCookies(req);
    console.log(`${tag} Resolved session:`, session ? `role=${session.role}, tenantId=${session.tenantId}` : "NULL (unauthenticated)");

    const tenantId = session?.tenantId;

    if (session?.role === 'admin') {
      const queryTenantId = req.nextUrl.searchParams.get('tenantId');
      const targetTenantId = queryTenantId && queryTenantId !== 'admin' ? queryTenantId : undefined;
      console.log(`${tag} Admin request — fetching chats for targetTenantId:`, targetTenantId || 'all');
      const allChats = targetTenantId ? await DB.getAllChats(targetTenantId) : await DB.getAllChatsAdminAllTenants();
      const allCustomers = targetTenantId ? await DB.getAllCustomers(targetTenantId) : await DB.getAllCustomersAdminAllTenants();
      console.log(`${tag} Admin — chats count: ${Object.keys(allChats).length}, customers: ${allCustomers.length}`);
      return NextResponse.json({ success: true, chats: allChats, customers: allCustomers });
    }

    if (!tenantId) {
      console.warn(`${tag} No tenantId in session — returning empty chats`);
      return NextResponse.json({ success: true, chats: {}, customers: [], _debug: "no_session" });
    }

    // Tenant-isolated fetch
    console.log(`${tag} Fetching chats for tenantId: ${tenantId}`);
    const chats = await DB.getAllChats(tenantId);
    const customers = await DB.getAllCustomers(tenantId);
    console.log(`${tag} Primary fetch — chats: ${Object.keys(chats).length}, customers: ${customers.length}`);

    const { isSupabaseConfigured } = await import('@/lib/supabase');
    
    console.log(`${tag} Returning — chats: ${Object.keys(chats).length}, customers: ${customers.length}, supabaseConnected: ${isSupabaseConfigured}`);
    return NextResponse.json({ 
      success: true, 
      chats, 
      customers,
      _debug: { 
        tenantId, 
        chatPhones: Object.keys(chats),
        supabaseConnected: isSupabaseConfigured
      }
    });

  } catch (err: any) {
    console.error(`${tag} Error:`, err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
