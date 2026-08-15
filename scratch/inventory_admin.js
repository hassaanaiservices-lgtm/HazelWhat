const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = 'c:\\Users\\Hassaan\\hazeldid\\.env';
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

const tablesToCheck = [
  'tenants', // query 'id' column
  'tenant_configs',
  'chat_messages',
  'customers',
  'appointments',
  'orders',
  'scheduled_follow_ups',
  'promotion_logs',
  'revival_campaigns',
  'whatsapp_auth'
];

async function runInventory() {
  console.log("=======================================================");
  console.log("STEP 1: INVENTORY OF ROWS FOR TENANT ID 'admin'");
  console.log("=======================================================");

  const counts = {};

  for (const table of tablesToCheck) {
    const colName = table === 'tenants' ? 'id' : 'tenant_id';
    try {
      const { count, error, data } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .eq(colName, 'admin');

      if (error) {
        counts[table] = { count: 0, error: error.message };
      } else {
        counts[table] = { count: count || 0, error: null };
        if (table === 'tenants' && data && data.length > 0) {
          console.log("\nDetails of 'admin' row in `tenants` table:");
          console.log(JSON.stringify(data[0], null, 2));
        }
      }
    } catch (e) {
      counts[table] = { count: 0, error: e.message };
    }
  }

  console.log("\n=======================================================");
  console.log("BASELINE INVENTORY SUMMARY FOR 'admin':");
  console.log(JSON.stringify(counts, null, 2));

  // Check active WhatsApp session via WhatsAppManager
  console.log("\n=======================================================");
  console.log("Checking Active WhatsApp Session:");
  console.log("=======================================================");
  try {
    const { WhatsAppManager } = require('../src/lib/whatsapp.ts');
    const activeId = WhatsAppManager.getActiveTenantId ? WhatsAppManager.getActiveTenantId() : 'NONE';
    console.log(`WhatsAppManager.getActiveTenantId(): "${activeId}"`);
    console.log(`Is 'admin' the currently active WhatsApp-connected tenant right now? -> ${activeId === 'admin'}`);
  } catch (err) {
    console.log("Could not read WhatsAppManager active tenant ID:", err.message);
  }
}

runInventory().catch(err => console.error(err));
