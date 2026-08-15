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

process.env.SUPER_ADMIN_PASSWORD = 'admin';
process.env.SESSION_SECRET = 'hazelsecretkey12345678901234567890';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

const repairs = [
  { id: 't-1001', username: 'trendaura', password: 'Tr3ndAura#2026!Sec' },
  { id: 't-1002', username: 'hazeldidstore', password: 'Hz1dStore$9982!Pz' },
  { id: 't-1003', username: 'ayanstore', password: 'Ay4nSt0re%7821!Kl' },
  { id: 't-1004', username: 'pizzabox', password: 'P1zz@Box!9942#Px' },
  { id: 'admin', username: 'adminclient', password: 'Adm1nCl1ent$2026!' },
];

async function runPartA() {
  console.log("\n=======================================================");
  console.log("PART A STEP 3: Single-Row Supabase Updates");
  console.log("=======================================================");

  for (const item of repairs) {
    const { data, error } = await supabase
      .from('tenants')
      .update({
        client_username: item.username,
        client_password: item.password
      })
      .eq('id', item.id)
      .select('id, client_username, client_password');

    if (error) {
      console.error(`❌ Update failed for ${item.id}:`, error.message);
    } else {
      console.log(`✅ Single-row update succeeded for ${item.id}:`, data);
    }
  }

  console.log("\n=======================================================");
  console.log("PART A STEP 4: Query Supabase & Test HTTP Login for each tenant");
  console.log("=======================================================");

  const { POST } = require('../src/app/api/auth/login/route.ts');
  const { NextRequest } = require('next/server');

  for (const item of repairs) {
    // 1. Direct query verification
    const { data: verifiedRow } = await supabase
      .from('tenants')
      .select('id, client_username, client_password')
      .eq('id', item.id)
      .single();

    console.log(`\nVerified DB Row for ${item.id}:`, verifiedRow);

    // 2. HTTP Login call
    const reqObj = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: item.username,
        password: item.password,
        remember: true
      })
    });

    const res = await POST(reqObj);
    const status = res.status;
    const body = await res.json();

    console.log(`Test Login Result for ${item.id} (username: '${item.username}'):`);
    console.log(`Status: ${status}`);
    console.log(`Response Body:`, JSON.stringify(body));
  }
}

runPartA().catch(err => console.error(err));
