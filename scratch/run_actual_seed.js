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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

console.log("Using Active Project Supabase URL:", url);
const supabase = createClient(url, key);

const TENANTS_SEED = [
  {
    id: 'admin',
    client_number: '0000',
    name: 'Admin',
    business_name: 'HazelWhat Admin',
    email: 'admin@hazeldid.com',
    status: 'active'
  },
  {
    id: 't-1004',
    client_number: '1004',
    name: 'Pizza Box',
    business_name: 'Pizza Box',
    phone_number: '03001234567',
    status: 'active'
  },
  {
    id: 't-1001',
    client_number: '1001',
    name: 'M Shafiq',
    business_name: 'Trend aura',
    phone_number: '0314 3060320',
    status: 'active'
  },
  {
    id: 't-1002',
    client_number: '1002',
    name: 'Leads',
    business_name: 'Hazeldid Store',
    phone_number: '03177598978',
    status: 'active'
  },
  {
    id: 't-1003',
    client_number: '1003',
    name: 'Ayan',
    business_name: 'ayan',
    phone_number: '03194188820',
    status: 'active'
  }
];

async function runSeed() {
  console.log("\n=== 1. SEEDING TENANTS TABLE ===");
  for (const t of TENANTS_SEED) {
    const { error } = await supabase.from('tenants').upsert(t, { onConflict: 'id' });
    if (error) {
      console.error(`❌ Tenant ${t.id} (${t.business_name}): ${error.message}`);
    } else {
      console.log(`✅ Tenant ${t.id} (${t.business_name}): SEEDED SUCCESSFULLY`);
    }
  }

  console.log("\n=== 2. SEEDING TENANT CONFIGS TABLE ===");
  const configsSeed = [
    { tenant_id: 't-1004', business_name: 'Pizza Box', global_ai_enabled: true },
    { tenant_id: 't-1001', business_name: 'Trend aura', global_ai_enabled: true },
    { tenant_id: 't-1002', business_name: 'Hazeldid Store', global_ai_enabled: true },
    { tenant_id: 't-1003', business_name: 'ayan', global_ai_enabled: true },
    { tenant_id: 'admin', business_name: 'HazelWhat Admin', global_ai_enabled: true }
  ];

  for (const cfg of configsSeed) {
    const { error } = await supabase.from('tenant_configs').upsert(cfg, { onConflict: 'tenant_id' });
    if (error) {
      console.error(`❌ Config ${cfg.tenant_id}: ${error.message}`);
    } else {
      console.log(`✅ Config ${cfg.tenant_id}: SEEDED SUCCESSFULLY`);
    }
  }

  console.log("\n=== 3. TESTING ORDERS & CUSTOMERS INSERT ===");
  const testOrder = {
    tenant_id: 't-1004',
    phone: '923001234567',
    customer_name: 'Test Customer',
    product_name: 'Cheese Lover Pizza',
    price: '1000',
    status: 'pending'
  };
  const { data: oData, error: oErr } = await supabase.from('orders').insert(testOrder);
  console.log("Insert Order test:", oErr ? `❌ ${oErr.message}` : "✅ SUCCESS! Order inserted cleanly.");

  const testCustomer = {
    tenant_id: 't-1004',
    phone: '923001234567',
    name: 'Test Customer',
    pipeline_stage: 'completed'
  };
  const { error: cErr } = await supabase.from('customers').upsert(testCustomer, { onConflict: 'tenant_id,phone' });
  console.log("Insert/Update Customer test:", cErr ? `❌ ${cErr.message}` : "✅ SUCCESS! Customer pipeline updated cleanly.");

  const { data: allOrders } = await supabase.from('orders').select('*');
  console.log("\nOrders in DB count:", allOrders?.length, allOrders);
}

runSeed().catch(err => console.error(err));
