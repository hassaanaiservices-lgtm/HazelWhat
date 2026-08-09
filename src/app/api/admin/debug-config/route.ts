import { NextRequest, NextResponse } from "next/server";
import { DB } from "@/lib/db";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/debug-config?tenantId=t-1004
 * Returns what the bot is currently seeing as config for a tenant.
 * Also shows raw Supabase data from both tables.
 * 
 * POST /api/admin/debug-config
 * Body: { tenantId, systemPrompt, productInfo, products }
 * Force-writes config directly to Supabase tenant_configs AND tenants table.
 */
export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') || 't-1004';
  
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. What getConfig returns (what the bot actually uses)
    const config = await DB.getConfig(tenantId);

    // 2. Raw tenants table
    const { data: tenant, error: tErr } = await supabase
      .from('tenants')
      .select('id, system_prompt, knowledge_base, product_knowledge_base, business_name')
      .eq('id', tenantId)
      .single();

    // 3. Raw tenant_configs table
    const { data: cfg, error: cErr } = await supabase
      .from('tenant_configs')
      .select('tenant_id, system_prompt, product_info, products, business_name')
      .eq('tenant_id', tenantId)
      .single();

    return NextResponse.json({
      success: true,
      tenantId,
      what_bot_sees: {
        systemPrompt: config.systemPrompt?.substring(0, 200),
        productInfo: config.productInfo?.substring(0, 200),
        productsCount: config.products?.length,
        businessName: config.businessName,
      },
      tenants_table: {
        found: !!tenant,
        error: tErr?.message,
        system_prompt: tenant?.system_prompt?.substring(0, 200),
        knowledge_base: tenant?.knowledge_base?.substring(0, 200),
        product_knowledge_base: tenant?.product_knowledge_base?.substring(0, 200),
      },
      tenant_configs_table: {
        found: !!cfg,
        error: cErr?.message,
        system_prompt: cfg?.system_prompt?.substring(0, 200),
        product_info: cfg?.product_info?.substring(0, 200),
        products_count: cfg?.products?.length || 0,
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId = 't-1004', systemPrompt, productInfo, products } = body;

    if (!systemPrompt && !productInfo) {
      return NextResponse.json({ success: false, error: 'systemPrompt or productInfo required' }, { status: 400 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Write to tenant_configs
    const { error: cfgErr } = await supabase.from('tenant_configs').upsert({
      tenant_id: tenantId,
      system_prompt: systemPrompt || '',
      product_info: productInfo || '',
      products: products || [],
      business_name: body.businessName || 'Pizza Box',
      global_ai_enabled: true,
    }, { onConflict: 'tenant_id' });

    // 2. Write to tenants table
    const { error: tenErr } = await supabase.from('tenants').update({
      system_prompt: systemPrompt || '',
      knowledge_base: productInfo || '',
    }).eq('id', tenantId);

    if (cfgErr || tenErr) {
      return NextResponse.json({
        success: false,
        cfgError: cfgErr?.message,
        tenError: tenErr?.message,
      }, { status: 500 });
    }

    // 3. Verify
    const config = await DB.getConfig(tenantId);
    
    return NextResponse.json({
      success: true,
      message: 'Config written to both tenant_configs and tenants tables',
      now_bot_sees: {
        systemPrompt: config.systemPrompt?.substring(0, 200),
        productInfo: config.productInfo?.substring(0, 200),
        productsCount: config.products?.length,
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
