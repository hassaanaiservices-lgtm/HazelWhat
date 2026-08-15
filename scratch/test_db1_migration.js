const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

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

loadEnv('c:\\Users\\Hassaan\\hazeldid\\.env');
loadEnv('c:\\Users\\Hassaan\\Music\\Hazelwhat.1\\.env.local');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

console.log("Using Supabase URL:", url);
console.log("Using Key (service_role check):", key.includes('service_role') ? "SERVICE_ROLE (RLS BYPASS)" : "ANON");

const supabase = createClient(url, key);

const TENANTS_SEED = [
  {
    id: 'admin',
    client_number: '0000',
    name: 'Admin',
    business_name: 'HazelWhat Admin',
    phone_number: '',
    email: 'admin@hazeldid.com',
    status: 'active',
    installation_fee: 0,
    monthly_subscription_fee: 0,
    currency: 'PKR',
    payment_status: 'paid',
    allocated_minutes: 9999,
    used_minutes: 0,
    client_username: 'admin',
    client_password: 'admin',
  },
  {
    id: 't-1003',
    client_number: '1003',
    name: 'Ayan',
    business_name: 'ayan',
    phone_number: '03194188820',
    email: 'client@business.com',
    status: 'active',
    installation_fee: 0,
    monthly_subscription_fee: 0,
    currency: 'PKR',
    payment_status: 'paid',
    allocated_minutes: 800,
    used_minutes: 0,
    client_username: 'ayan_247',
    client_password: 'client1003',
  },
  {
    id: 't-1004',
    client_number: '1004',
    name: 'Pizza Box',
    business_name: 'Pizza Box',
    phone_number: '03001234567',
    email: 'pizzabox@business.com',
    status: 'active',
    installation_fee: 0,
    monthly_subscription_fee: 9000,
    currency: 'PKR',
    payment_status: 'paid',
    allocated_minutes: 800,
    used_minutes: 0,
    client_username: 'pizzabox_183343',
    client_password: 'client1004',
  },
  {
    id: 't-1002',
    client_number: '1002',
    name: 'Leads',
    business_name: 'Hazeldid Store',
    phone_number: '03177598978',
    email: 'client@business.com',
    status: 'active',
    installation_fee: 0,
    monthly_subscription_fee: 0,
    currency: 'PKR',
    payment_status: 'paid',
    allocated_minutes: 800,
    used_minutes: 0,
    client_username: 'hazeldid_346',
    client_password: 'client1002',
  },
  {
    id: 't-1001',
    client_number: '1001',
    name: 'M Shafiq',
    business_name: 'Trend aura',
    phone_number: '0314 3060320',
    email: 'client@business.com',
    status: 'active',
    installation_fee: 0,
    monthly_subscription_fee: 9000,
    currency: 'PKR',
    payment_status: 'paid',
    allocated_minutes: 800,
    used_minutes: 0,
    client_username: 'trend_aura_423',
    client_password: 'client1001',
  }
];

async function runSeed() {
  console.log("\n=== SEEDING TENANTS TABLE ===");
  for (const tenant of TENANTS_SEED) {
    const { error } = await supabase.from('tenants').upsert(tenant, { onConflict: 'id' });
    if (error) {
      console.error(`❌ Tenant ${tenant.id} (${tenant.business_name}): ${error.message}`);
    } else {
      console.log(`✅ Tenant ${tenant.id} (${tenant.business_name}): seeded successfully`);
    }
  }

  console.log("\n=== SEEDING TENANT CONFIGS TABLE ===");
  const configsSeed = [
    {
      tenant_id: 't-1004',
      business_name: 'Pizza Box',
      global_ai_enabled: true,
      system_prompt: 'You are a friendly, helpful AI team member for Pizza Box.',
      product_info: 'Pizza Box Menu & Specials'
    },
    {
      tenant_id: 't-1001',
      business_name: 'Trend aura',
      global_ai_enabled: true,
      system_prompt: 'You are a friendly, helpful AI team member for Trend Aura.',
      product_info: 'Trend Aura Products'
    },
    {
      tenant_id: 't-1002',
      business_name: 'Hazeldid Store',
      global_ai_enabled: true
    },
    {
      tenant_id: 't-1003',
      business_name: 'ayan',
      global_ai_enabled: true
    },
    {
      tenant_id: 'admin',
      business_name: 'HazelWhat Admin',
      global_ai_enabled: true
    }
  ];

  for (const cfg of configsSeed) {
    const { error } = await supabase.from('tenant_configs').upsert(cfg, { onConflict: 'tenant_id' });
    if (error) {
      console.error(`❌ Config ${cfg.tenant_id} (${cfg.business_name}): ${error.message}`);
    } else {
      console.log(`✅ Config ${cfg.tenant_id} (${cfg.business_name}): seeded successfully`);
    }
  }

  console.log("\n=== TESTING INSERTS INTO CHAT_MESSAGES, ORDERS, CUSTOMERS ===");
  const testMsg = {
    tenant_id: 't-1004',
    phone: '923001234567',
    role: 'system',
    content: 'Schema migration test message'
  };
  const { data: mData, error: mErr } = await supabase.from('chat_messages').insert(testMsg);
  console.log("Insert chat_messages with 't-1004':", { error: mErr?.message || 'SUCCESS' });

  const testCustomer = {
    tenant_id: 't-1004',
    phone: '923001234567',
    name: 'Schema Verification Customer',
    pipeline_stage: 'new'
  };
  const { error: custErr } = await supabase.from('customers').upsert(testCustomer, { onConflict: 'tenant_id,phone' });
  console.log("Insert customer with 't-1004':", { error: custErr?.message || 'SUCCESS' });

  const testOrder = {
    tenant_id: 't-1004',
    phone: '923001234567',
    product_name: 'Cheese Lover Pizza',
    price: '1000',
    status: 'pending'
  };
  const { error: ordErr } = await supabase.from('orders').insert(testOrder);
  console.log("Insert order with 't-1004':", { error: ordErr?.message || 'SUCCESS' });
}

runSeed().catch(err => console.error(err));
