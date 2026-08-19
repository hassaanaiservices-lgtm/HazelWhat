const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
function loadEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (match) {
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        process.env[match[1].trim()] = val;
      }
    });
  } catch (e) {}
}

loadEnvFile(path.join(process.cwd(), '.env.local'));
loadEnvFile(path.join(process.cwd(), '.env'));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Cannot connect — env vars missing!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("=== SEEDING DUMMY CLIENT ===");
  
  const dummyTenant = {
    id: 't-9999',
    client_number: '9999',
    name: 'Dummy Client',
    business_name: 'Dummy Store',
    phone_number: '03009999999',
    email: 'dummy@client.com',
    status: 'active',
    installation_fee: 0,
    monthly_subscription_fee: 0,
    currency: 'PKR',
    payment_status: 'paid',
    allocated_minutes: 800,
    used_minutes: 0,
    client_username: 'dummy',
    client_password: 'dummypassword'
  };

  const { error: upsertErr } = await supabase
    .from('tenants')
    .upsert(dummyTenant, { onConflict: 'id' });

  if (upsertErr) {
    console.error("❌ Failed to seed dummy tenant:", upsertErr.message);
  } else {
    console.log("✅ Dummy tenant successfully seeded!");
  }

  // Also seed tenant_configs so that the client configuration works
  const { error: configErr } = await supabase
    .from('tenant_configs')
    .upsert({
      tenant_id: 't-9999',
      system_prompt: 'You are a helpful assistant for Dummy Store.',
      product_info: 'Dummy product 1: $10\nDummy product 2: $20',
      business_name: 'Dummy Store',
      global_ai_enabled: true,
      products: []
    }, { onConflict: 'tenant_id' });

  if (configErr) {
    console.error("❌ Failed to seed dummy tenant config:", configErr.message);
  } else {
    console.log("✅ Dummy tenant config successfully seeded!");
  }

  console.log("\n=== ALL TENANTS IN SUPABASE ===");
  const { data: tenants, error: listErr } = await supabase
    .from('tenants')
    .select('id, name, business_name, client_username, client_password');

  if (listErr) {
    console.error("Failed to fetch tenants list:", listErr.message);
  } else {
    tenants.forEach(t => {
      console.log(`- ID: ${t.id} | Name: ${t.name} | Business: ${t.business_name} | Username: ${t.client_username} | Password: ${t.client_password}`);
    });
  }
}

main().catch(console.error);
