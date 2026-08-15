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

process.env.SUPER_ADMIN_PASSWORD = 'admin123';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function testHttpLogin() {
  const { DB } = require('../src/lib/db.ts');

  console.log("\n=======================================================");
  console.log("STEP 1.1 — Create test client 'realtest_7777'");
  console.log("=======================================================");

  const testTenant = {
    id: 't-7777',
    client_number: '7777',
    name: 'Real Test Client',
    business_name: 'Real Test Biz',
    email: 'realtest@business.com',
    status: 'active',
    client_username: 'realtest_7777',
    client_password: 'HazelPass@7777'
  };

  await supabase.from('tenants').upsert(testTenant, { onConflict: 'id' });

  console.log("\n=======================================================");
  console.log("STEP 1.2 — Query Supabase directly for 'realtest_7777'");
  console.log("=======================================================");

  const { data: rawRows } = await supabase
    .from('tenants')
    .select('id, client_username, client_password, status')
    .eq('client_username', 'realtest_7777');

  console.log("Supabase direct query row:");
  console.log(JSON.stringify(rawRows, null, 2));

  console.log("\n=======================================================");
  console.log("STEP 1.3 & STEP 2 — Test Login via Next.js POST /api/auth/login logic");
  console.log("=======================================================");

  // Import POST from route.ts
  const { POST } = require('../src/app/api/auth/login/route.ts');
  const { NextRequest } = require('next/server');

  const reqObj = new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: 'realtest_7777',
      password: 'HazelPass@7777',
      remember: true
    })
  });

  const res = await POST(reqObj);
  const status = res.status;
  const bodyJson = await res.json();

  console.log(`Response Status: ${status}`);
  console.log("Response Body:", JSON.stringify(bodyJson, null, 2));

  // Cleanup
  await supabase.from('tenants').delete().eq('id', 't-7777');
}

testHttpLogin().catch(err => console.error(err));
