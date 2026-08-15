const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv(envPath) {
  if (fs.existsSync(envPath)) {
    console.log(`Loading env from ${envPath}`);
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2 && !line.startsWith('#')) {
        const key = parts[0].trim();
        let val = parts.slice(1).join('=').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    });
  }
}

loadEnv('c:\\Users\\Hassaan\\Music\\Hazelwhat.1\\.env.local');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

console.log("Supabase URL:", supabaseUrl);
console.log("Supabase Key:", supabaseKey ? "(Found)" : "MISSING");

if (!supabaseUrl || !supabaseKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  console.log("\n=== 1. FETCH ALL TENANTS ===");
  const { data: tenants, error: tErr } = await supabase.from('tenants').select('*');
  if (tErr) console.error("Error fetching tenants:", tErr);
  else {
    console.log(`Found ${tenants.length} tenants:`);
    tenants.forEach(t => console.log(`- ID: ${t.id} | Name: ${t.name} | Business: ${t.business_name} | Username: ${t.client_username}`));
  }

  console.log("\n=== 2. FETCH TENANT CONFIGS ===");
  const { data: configs, error: cErr } = await supabase.from('tenant_configs').select('*');
  if (cErr) console.error("Error fetching tenant_configs:", cErr);
  else {
    console.log(`Found ${configs?.length} configs:`);
    configs.forEach(c => console.log(`- Config ID: ${c.id} | Tenant ID: ${c.tenant_id} | Business: ${c.business_name}`));
  }

  console.log("\n=== 3. KNOWLEDGE BASE & PRODUCTS FOR EACH TENANT ===");
  for (const t of (tenants || [])) {
    console.log(`\n========================================`);
    console.log(`Tenant ID: ${t.id} | Name: "${t.name}" | Business Name: "${t.business_name}"`);
    console.log(`t.knowledge_base (${(t.knowledge_base || '').length} chars):`);
    console.log((t.knowledge_base || '(EMPTY)').substring(0, 500));
    console.log(`\nt.product_knowledge_base (${(t.product_knowledge_base || '').length} chars):`);
    console.log((t.product_knowledge_base || '(EMPTY)').substring(0, 500));
    console.log(`\nt.products:`, JSON.stringify(t.products || []).substring(0, 300));

    const cfg = (configs || []).find(c => c.tenant_id === t.id);
    if (cfg) {
      console.log(`\nConfig for tenant ${t.id}:`);
      console.log(`cfg.product_info (${(cfg.product_info || '').length} chars):`);
      console.log((cfg.product_info || '(EMPTY)').substring(0, 500));
      console.log(`cfg.system_prompt (${(cfg.system_prompt || '').length} chars):`);
      console.log((cfg.system_prompt || '(EMPTY)').substring(0, 300));
    } else {
      console.log(`No config entry in tenant_configs for tenant_id: ${t.id}`);
    }
  }

  console.log("\n=== 4. CHECK FOR EMBEDDINGS / VECTOR TABLES ===");
  const tables = ['documents', 'embeddings', 'knowledge_chunks', 'vector_store', 'knowledge_base_chunks'];
  for (const tbl of tables) {
    const { data, error } = await supabase.from(tbl).select('*').limit(1);
    if (error) {
      console.log(`Table '${tbl}': DOES NOT EXIST (${error.message})`);
    } else {
      console.log(`Table '${tbl}': EXISTS with ${data.length} sample rows`);
    }
  }
}

inspect().catch(err => console.error(err));
