const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv(envPath) {
  if (fs.existsSync(envPath)) {
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase environment variables missing!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchemaAndData() {
  console.log("=== 1. COLUMN TYPES IN LIVE SUPABASE SCHEMA ===");
  // Querying information_schema.columns via raw SQL RPC or inspecting error messages / types
  // Since supabase-js doesn't expose raw SQL directly unless an RPC function exists, let's test RPC or select queries.
  // First, let's test querying information_schema if enabled, or testing string vs UUID filter queries.
  
  // Let's test RPC or direct query on information_schema.columns if available
  const { data: cols, error: colErr } = await supabase
    .rpc('get_schema_info'); // if exists

  if (colErr) {
    console.log("RPC get_schema_info not defined, inspecting column types via query testing...");
  }

  // Test selecting from tenants with text id
  const { data: tText, error: tTextErr } = await supabase.from('tenants').select('*').eq('id', 't-1004');
  console.log("Query tenants.id = 't-1004':", { data: tText, error: tTextErr?.message || tTextErr });

  // Test selecting from tenant_configs with text tenant_id
  const { data: tcText, error: tcTextErr } = await supabase.from('tenant_configs').select('*').eq('tenant_id', 't-1004');
  console.log("Query tenant_configs.tenant_id = 't-1004':", { data: tcText, error: tcTextErr?.message || tcTextErr });

  // Test selecting from chat_messages with text tenant_id
  const { data: cmText, error: cmTextErr } = await supabase.from('chat_messages').select('*').eq('tenant_id', 't-1004').limit(2);
  console.log("Query chat_messages.tenant_id = 't-1004':", { data: cmText, error: cmTextErr?.message || cmTextErr });

  console.log("\n=== 2. DISTINCT TENANT_IDs IN CHAT_MESSAGES ===");
  const { data: allChats, error: chatErr } = await supabase.from('chat_messages').select('tenant_id');
  if (chatErr) {
    console.error("Error querying chat_messages:", chatErr);
  } else {
    const tenantIdsCount = {};
    (allChats || []).forEach(c => {
      const tid = c.tenant_id;
      tenantIdsCount[tid] = (tenantIdsCount[tid] || 0) + 1;
    });
    console.log("Distinct tenant_id counts in chat_messages:", tenantIdsCount);
  }

  console.log("\n=== 3. ALL ROWS IN TENANTS TABLE ===");
  const { data: allTenants, error: allTErr } = await supabase.from('tenants').select('*');
  console.log("Raw tenants table content (count:", allTenants?.length, "):", allTenants);

  console.log("\n=== 4. ALL ROWS IN TENANT_CONFIGS TABLE ===");
  const { data: allConfigs, error: allCfgErr } = await supabase.from('tenant_configs').select('*');
  console.log("Raw tenant_configs table content (count:", allConfigs?.length, "):", allConfigs);

  console.log("\n=== 5. CHECK OTHER TABLES FOR TENANT REFS (customers, orders, etc.) ===");
  const tables = ['customers', 'orders', 'appointments', 'scheduled_follow_ups', 'revival_campaigns', 'promotion_logs'];
  for (const tbl of tables) {
    const { data, error } = await supabase.from(tbl).select('tenant_id').limit(100);
    if (error) {
      console.log(`Table '${tbl}' query error: ${error.message}`);
    } else {
      const counts = {};
      (data || []).forEach(r => { counts[r.tenant_id] = (counts[r.tenant_id] || 0) + 1; });
      console.log(`Table '${tbl}' distinct tenant_ids:`, counts);
    }
  }
}

inspectSchemaAndData().catch(err => console.error(err));
