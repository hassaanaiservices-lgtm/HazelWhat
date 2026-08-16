import { supabase } from "../src/lib/db";

async function run() {
  if (!supabase) {
    console.error("Supabase is not configured!");
    return;
  }
  
  console.log("=== DIRECT SUPABASE QUERY ===");
  
  const { data: tenants, error: tErr } = await supabase.from('tenants').select('*');
  console.log("Tenants table rows count:", tenants?.length || 0);
  console.log("Tenants table error:", tErr);
  console.log("Tenants rows:", JSON.stringify(tenants, null, 2));
  
  const { data: configs, error: cErr } = await supabase.from('tenant_configs').select('*');
  console.log("Tenant_configs table rows count:", configs?.length || 0);
  console.log("Tenant_configs table error:", cErr);
  console.log("Tenant_configs rows:", JSON.stringify(configs, null, 2));
}

run().catch(console.error);
