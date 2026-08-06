import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DB } from "@/lib/db";

export const dynamic = 'force-dynamic';

async function getTenantIdFromSession(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("hazel_session");
    if (sessionCookie && sessionCookie.value) {
      const session = JSON.parse(sessionCookie.value);
      return session.role === 'admin' ? undefined : session.tenantId;
    }
  } catch (e) {}
  return undefined;
}

export async function GET() {
  try {
    const tenantId = await getTenantIdFromSession();
    let config = await DB.getConfig(tenantId);

    if (tenantId) {
      const tenant = await DB.getTenantById(tenantId);
      if (tenant) {
        config = {
          ...config,
          systemPrompt: tenant.systemPrompt || config.systemPrompt,
          productInfo: tenant.knowledgeBase || config.productInfo,
          products: tenant.products || config.products || [],
          deepgramApiKey: tenant.deepgramApiKey || config.deepgramApiKey,
          deepgramVoice: tenant.deepgramVoice || config.deepgramVoice
        };
      }
    }

    return NextResponse.json({ success: true, config });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = await getTenantIdFromSession();

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

    const updatedConfig = await DB.getConfig(tenantId);
    return NextResponse.json({ success: true, config: updatedConfig });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
