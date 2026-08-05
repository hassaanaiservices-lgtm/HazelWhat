import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DB } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = DB.getConfig();
    return NextResponse.json({ success: true, config });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    DB.updateConfig(body);

    // Sync changes to tenant database so System Prompt, Knowledge Base, & Products stay synchronized
    try {
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get("hazel_session");
      const tenants = DB.getTenants();

      if (tenants && tenants.length > 0) {
        let targetTenantId: string | null = null;
        if (sessionCookie && sessionCookie.value) {
          try {
            const session = JSON.parse(sessionCookie.value);
            if (session.tenantId && session.tenantId !== "admin") {
              targetTenantId = session.tenantId;
            }
          } catch (e) {}
        }

        let updated = false;
        tenants.forEach((t) => {
          if (!targetTenantId || t.id === targetTenantId) {
            if (body.systemPrompt !== undefined) t.systemPrompt = body.systemPrompt;
            if (body.productInfo !== undefined || body.knowledgeBase !== undefined) {
              const kbVal = body.productInfo !== undefined ? body.productInfo : body.knowledgeBase;
              t.knowledgeBase = kbVal;
              t.productKnowledgeBase = kbVal;
            }
            if (body.products !== undefined) t.products = body.products;
            if (body.storeUrl !== undefined) (t as any).storeUrl = body.storeUrl;
            if (body.storeCurrency !== undefined) (t as any).currency = body.storeCurrency;
            updated = true;
          }
        });

        if (updated) {
          DB.saveTenants(tenants);
        }
      }
    } catch (e) {
      console.error("[Config API] Error syncing tenant records:", e);
    }

    return NextResponse.json({ success: true, config: DB.getConfig() });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

