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

async function runStep1And2() {
  console.log("\n=======================================================");
  console.log("STEP 1.1 — Create one new test client in Supabase");
  console.log("=======================================================");
  
  const testTenant = {
    id: 't-9999',
    client_number: '9999',
    name: 'Test Client Diagnostic',
    business_name: 'Diag Business',
    phone_number: '03009999999',
    email: 'diagtest@business.com',
    status: 'active',
    client_username: 'diagtest_9999',
    client_password: 'HazelPass@9999'
  };

  const { error: upsertErr } = await supabase.from('tenants').upsert(testTenant, { onConflict: 'id' });
  if (upsertErr) {
    console.error("❌ Failed to create test tenant:", upsertErr.message);
    return;
  }
  console.log("✅ Test tenant created: username='diagtest_9999', password='HazelPass@9999'");

  console.log("\n=======================================================");
  console.log("STEP 1.2 — Query Supabase directly for that tenant");
  console.log("=======================================================");
  
  const { data: directRows, error: directErr } = await supabase
    .from('tenants')
    .select('id, client_username, client_password, status')
    .eq('client_username', 'diagtest_9999');

  if (directErr) {
    console.error("❌ Direct query error:", directErr.message);
  } else {
    console.log("Raw Row from Supabase `tenants` table:");
    console.log(JSON.stringify(directRows, null, 2));
    const rawPass = directRows?.[0]?.client_password;
    console.log(`Raw client_password value: "${rawPass}" (isBcrypt starting with $2: ${Boolean(rawPass && rawPass.startsWith('$2'))})`);
  }

  console.log("\n=======================================================");
  console.log("STEP 1.3 & STEP 2 — Test login & console trace execution");
  console.log("=======================================================");

  const { DB } = require('../src/lib/db.ts');
  
  // Trace getTenants
  console.log("\n--- Tracing DB.getTenants() ---");
  const tenants = await DB.getTenants();
  console.log(`Total tenants in DB.getTenants(): ${tenants.length}`);

  // Trace getTenantByUsername
  console.log("\n--- Tracing DB.getTenantByUsername('diagtest_9999') ---");
  const tenant = await DB.getTenantByUsername('diagtest_9999');

  // Trace Password comparison logic
  console.log("\n--- Tracing Login Route logic ---");
  if (!tenant) {
    console.log("LOGIN RESULT: Status 401, Body: { success: false, error: 'Invalid username or password' } (TENANT NOT FOUND)");
  } else {
    const bcrypt = require('bcryptjs');
    const inputPassword = 'HazelPass@9999';
    const storedPass = (tenant.clientPassword || "").trim();
    const isBcrypt = storedPass.startsWith("$2a$") || storedPass.startsWith("$2b$") || storedPass.startsWith("$2y$");

    console.log(`[DIAG LOG] Login Route: storedPass="${storedPass}", isBcrypt=${isBcrypt}, inputPassword="${inputPassword}" right before comparison.`);

    let passMatches = false;
    if (isBcrypt) {
      passMatches = bcrypt.compareSync(inputPassword, storedPass);
    } else {
      passMatches = !!storedPass && (inputPassword === storedPass || inputPassword.toLowerCase() === storedPass.toLowerCase());
    }

    if (passMatches) {
      console.log("LOGIN RESULT: Status 200, Body: { success: true, user: ... }");
    } else {
      console.log("LOGIN RESULT: Status 401, Body: { success: false, error: 'Invalid username or password' } (PASSWORD MISMATCH)");
    }
  }

  console.log("\n=======================================================");
  console.log("ADDITIONAL CHECK — Previously existing clients in Supabase");
  console.log("=======================================================");
  
  const { data: existingRows, error: existingErr } = await supabase
    .from('tenants')
    .select('id, client_username, client_password, status')
    .in('id', ['t-1001', 't-1002', 't-1003', 't-1004']);

  if (existingErr) {
    console.error("❌ Existing tenants query error:", existingErr.message);
  } else {
    console.log(`Existing tenants fetched from Supabase count: ${existingRows?.length}`);
    console.log(JSON.stringify(existingRows, null, 2));
  }

  // Cleanup test tenant
  await supabase.from('tenants').delete().eq('id', 't-9999');
}

runStep1And2().catch(err => console.error(err));
