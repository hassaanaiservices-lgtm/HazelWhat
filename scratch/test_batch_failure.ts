export {};
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = 'c:\\Users\\Hassaan\\hazeldid\\.env';
const content = fs.readFileSync(envPath, 'utf8');
content.split(/\r?\n/).forEach((line: string) => {
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

async function testBatchFailure() {
  const { POST } = require('../src/app/api/admin/tenants/route.ts');
  const { NextRequest } = require('next/server');
  const { DB } = require('../src/lib/db.ts');

  console.log("\n=======================================================");
  console.log("PART B TEST 1: Intra-batch & Database Collision Validation");
  console.log("=======================================================");

  const currentTenants = await DB.getTenants();

  const goodTenant1 = {
    ...currentTenants[0],
    id: 't-8881',
    clientNumber: '8881',
    name: 'Batch Good Client',
    businessName: 'Good Business',
    clientUsername: 'batch_good_8881',
    clientPassword: 'GoodPass@8881'
  };

  const collidingTenant = {
    ...currentTenants[0],
    id: 't-8882',
    clientNumber: '8882',
    name: 'Batch Bad Client',
    businessName: 'Bad Business',
    clientUsername: 'pizzabox', // Collision with existing tenant t-1004 (pizzabox)!
    clientPassword: 'BadPass@8882'
  };

  const { signJWT } = require('../src/lib/auth-session.ts');
  const adminToken = await signJWT({ role: 'admin', tenantId: 'admin' }, 3600);

  // Attempt POST /api/admin/tenants with colliding tenant
  const reqObj = new NextRequest('http://localhost:3000/api/admin/tenants', {
    method: 'POST',
    headers: { 'Cookie': `hazel_admin_session=${adminToken}` },
    body: JSON.stringify({ tenants: [goodTenant1, collidingTenant] })
  });

  const res = await POST(reqObj);
  const status = res.status;
  const body = await res.json();

  console.log(`Response Status: ${status}`);
  console.log("Response Error Body:", JSON.stringify(body, null, 2));

  console.log("\n=======================================================");
  console.log("PART B TEST 2: Per-Tenant Individual Upsert (Promise.allSettled)");
  console.log("=======================================================");

  // Now test DB.saveTenantsAsync directly with a batch of tenants
  const validTenant = {
    id: 't-8883',
    clientNumber: '8883',
    name: 'Valid Tenant 8883',
    businessName: 'Valid Biz',
    status: 'active',
    clientUsername: 'valid_user_8883',
    clientPassword: 'ValidPass@8883'
  };

  const saveRes = await DB.saveTenantsAsync([goodTenant1, validTenant]);
  console.log("DB.saveTenantsAsync result object:");
  console.log(JSON.stringify(saveRes, null, 2));

  // Verify validTenant was successfully saved in Supabase
  const { data: dbCheck } = await supabase
    .from('tenants')
    .select('id, client_username, client_password')
    .eq('id', 't-8883')
    .single();

  console.log("\nDirect Supabase Check for t-8883:", dbCheck);

  // Cleanup test records
  await supabase.from('tenants').delete().in('id', ['t-8881', 't-8882', 't-8883']);
  console.log("\n✅ Test cleanup complete.");
}

testBatchFailure().catch(err => console.error(err));
