import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DB } from "@/lib/db";
import { WhatsAppManager } from "@/lib/whatsapp";

export const dynamic = 'force-dynamic';

async function getTenantIdFromSession(request?: NextRequest): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("hazel_session");
    if (sessionCookie && sessionCookie.value) {
      const session = JSON.parse(sessionCookie.value);
      if (session.role === 'client' && session.tenantId) {
        return session.tenantId;
      }
      if (session.role === 'admin') {
        const queryTenantId = request?.nextUrl?.searchParams?.get('tenantId');
        if (queryTenantId) return queryTenantId;
        const activeManagerTenant = WhatsAppManager.getActiveTenantId();
        if (activeManagerTenant && activeManagerTenant !== 'admin') return activeManagerTenant;
        const tenants = await DB.getTenants();
        if (tenants && tenants.length > 0) return tenants[0].id;
        return session.tenantId || 'admin';
      }
      return session.tenantId;
    }
  } catch (e) {}
  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = await getTenantIdFromSession(request);
    let config = await DB.getConfig(tenantId);

    const resolvedTenantId = tenantId || 'admin';
    const tenant = await DB.getTenantById(resolvedTenantId);
    if (tenant) {
      config = {
        ...config,
        systemPrompt: (tenant.systemPrompt && tenant.systemPrompt.trim() !== '') ? tenant.systemPrompt : config.systemPrompt,
        productInfo: (tenant.knowledgeBase && tenant.knowledgeBase.trim() !== '') ? tenant.knowledgeBase : config.productInfo,
        products: (tenant.products && tenant.products.length > 0) ? tenant.products : (config.products || []),
        deepgramApiKey: tenant.deepgramApiKey || config.deepgramApiKey,
        deepgramVoice: tenant.deepgramVoice || config.deepgramVoice,
        businessName: tenant.businessName || tenant.name || config.businessName
      };
    }

    return NextResponse.json({ success: true, config });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = await getTenantIdFromSession(request);

    await DB.updateConfig(body, tenantId);

    // Sync to tenant record if tenantId is present
    if (tenantId) {
      const tenant = await DB.getTenantById(tenantId);
      if (tenant) {
        if (body.systemPrompt !== undefined) tenant.systemPrompt = body.systemPrompt;
        if (body.productInfo !== undefined || body.knowledgeBase !== undefined) {
          const kbVal = body.productInfo !== undefined ? body.productInfo : body.knowledgeBase;
          tenant.knowledgeBase = kbVal;
          tenant.productKnowledgeBase = kbVal;
        }
        if (body.products !== undefined) tenant.products = body.products;
        await DB.saveTenants([tenant]);
      }
    }

    let updatedConfig = await DB.getConfig(tenantId);
    if (tenantId) {
      const tenant = await DB.getTenantById(tenantId);
      if (tenant) {
        updatedConfig = {
          ...updatedConfig,
          systemPrompt: (tenant.systemPrompt && tenant.systemPrompt.trim() !== '') ? tenant.systemPrompt : updatedConfig.systemPrompt,
          productInfo: (tenant.knowledgeBase && tenant.knowledgeBase.trim() !== '') ? tenant.knowledgeBase : updatedConfig.productInfo,
          products: (tenant.products && tenant.products.length > 0) ? tenant.products : (updatedConfig.products || []),
          businessName: tenant.businessName || tenant.name || updatedConfig.businessName
        };
      }
    }

    return NextResponse.json({ success: true, config: updatedConfig });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
