const fs = require('fs');
const path = require('path');

// Read .env.local manually
function loadEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    });
  } catch (e) {}
}

loadEnvFile(path.join(process.cwd(), '.env.local'));
loadEnvFile(path.join(process.cwd(), '.env'));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("Supabase URL:", SUPABASE_URL ? "✅ Present" : "❌ MISSING");
console.log("Supabase Key:", SUPABASE_KEY ? "✅ Present" : "❌ MISSING");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Cannot connect — env vars missing!");
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const TARGET_TENANT = 't-1004';

async function main() {
  console.log("\n=== [1] tenants table ===");
  const { data: tenant, error: tErr } = await supabase.from('tenants').select('id, system_prompt, knowledge_base, product_knowledge_base').eq('id', TARGET_TENANT).single();
  if (tErr) console.error("tenants error:", tErr.message);
  if (tenant) {
    console.log("system_prompt:", tenant.system_prompt?.substring(0, 120) || "❌ EMPTY/NULL");
    console.log("knowledge_base:", tenant.knowledge_base?.substring(0, 120) || "❌ EMPTY/NULL");
    console.log("product_knowledge_base:", tenant.product_knowledge_base?.substring(0, 120) || "❌ EMPTY/NULL");
  } else {
    console.log("❌ No tenant row found for t-1004!");
  }

  console.log("\n=== [2] tenant_configs table ===");
  const { data: cfg, error: cErr } = await supabase.from('tenant_configs').select('tenant_id, system_prompt, product_info, products').eq('tenant_id', TARGET_TENANT).single();
  if (cErr) console.error("tenant_configs error:", cErr.message);
  if (cfg) {
    console.log("system_prompt:", cfg.system_prompt?.substring(0, 120) || "❌ EMPTY/NULL");
    console.log("product_info:", cfg.product_info?.substring(0, 120) || "❌ EMPTY/NULL");
    console.log("products count:", cfg.products?.length || 0);
  } else {
    console.log("❌ NO ROW in tenant_configs for t-1004 — this is why KB is empty!");
  }

  console.log("\n=== [3] whatsapp_auth active_tenant ===");
  const { data: auth, error: aErr } = await supabase.from('whatsapp_auth').select('key_data').eq('tenant_id', 'default').eq('key_id', 'active_tenant').single();
  if (aErr) console.error("whatsapp_auth error:", aErr.message);
  console.log("active_tenant saved:", auth?.key_data || "❌ NOT SAVED");

  console.log("\n=== [4] ALL tenant_configs rows ===");
  const { data: allCfgs } = await supabase.from('tenant_configs').select('tenant_id, system_prompt').limit(10);
  (allCfgs || []).forEach(c => console.log(` - ${c.tenant_id}: prompt="${c.system_prompt?.substring(0,60)}"`));
  if (!allCfgs?.length) console.log("❌ tenant_configs is EMPTY (no rows at all!)");
}

main().catch(console.error);
