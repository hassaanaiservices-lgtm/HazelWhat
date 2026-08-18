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
    let chats = await DB.getAllChats(tenantId);
    let customers = await DB.getAllCustomers(tenantId);

    // Auto-seed atomixweb dummy customers, orders, and chats if empty
    if (tenantId === 't-1007' && Object.keys(chats).length === 0 && customers.length === 0) {
      console.log(`${tag} Auto-seeding dummy contacts, chats, and orders for atomixweb (t-1007)...`);
      const dummyCustomers = [
        {
          tenantId: 't-1007',
          phone: "923001112233",
          name: "Ali Raza (Startup Founder)",
          pipelineStage: "warm" as const,
          leadStatus: "hot" as const,
          tags: ["interested-in-ai-bot", "quote-requested"],
          isLead: true,
          leadCreatedAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString()
        },
        {
          tenantId: 't-1007',
          phone: "923214445566",
          name: "Usman Ghani (E-Commerce Store Owner)",
          pipelineStage: "qualified" as const,
          leadStatus: "hot" as const,
          tags: ["shopify-store", "needs-app"],
          isLead: true,
          leadCreatedAt: new Date(Date.now() - 3600000 * 24 * 4).toISOString()
        },
        {
          tenantId: 't-1007',
          phone: "923337778899",
          name: "Sarah Khan (Marketing Director)",
          pipelineStage: "completed" as const,
          leadStatus: "cold" as const,
          tags: ["uiux-design", "completed-client"],
          isLead: true,
          leadCreatedAt: new Date(Date.now() - 3600000 * 24 * 10).toISOString()
        }
      ];

      for (const c of dummyCustomers) {
        await DB.updateCustomer(c.phone, c, 't-1007');
      }

      await DB.addChatMessage("923001112233", { role: "user", content: "AOA! Do you build WhatsApp AI bots for sales?" }, 't-1007');
      await DB.addChatMessage("923001112233", { role: "assistant", content: "Walaikum Assalam Ali! Yes, we build full autonomous AI WhatsApp Chatbots integrated with DeepSeek and catalog search." }, 't-1007');
      await DB.addChatMessage("923001112233", { role: "user", content: "Great, what is the price for the bot package?" }, 't-1007');
      await DB.addChatMessage("923001112233", { role: "assistant", content: "Our AI WhatsApp Chatbot package is PKR 85,000 including setup, catalog sync, and custom prompt training." }, 't-1007');

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

      chats = await DB.getAllChats(tenantId);
      customers = await DB.getAllCustomers(tenantId);
    }
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

export async function DELETE(req: NextRequest) {
  const tag = "[Chats API DELETE]";
  try {
    const session = await getSessionFromCookies(req);
    const tenantId = session?.tenantId;

    if (!tenantId || session?.role === 'admin') {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Clear all chats from memory store for this tenant
    await DB.clearAllChatsAndCustomers(tenantId);

    console.log(`${tag} Cleared all chats and customers for tenant: ${tenantId}`);
    return NextResponse.json({ success: true, message: "All chats cleared successfully" });
  } catch (err: any) {
    console.error(`${tag} Error:`, err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
