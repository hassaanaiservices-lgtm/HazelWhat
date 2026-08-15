const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

async function executeMigration() {
  console.log("\n=======================================================");
  console.log("STEP 3: EXECUTE CAREFUL MIGRATION OF 'admin' -> 't-1005'");
  console.log("=======================================================");

  // 1. Fetch exact row for 'admin' from tenants table
  const { data: adminRows, error: fetchErr } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', 'admin');

  if (fetchErr || !adminRows || adminRows.length === 0) {
    console.error("❌ Failed to fetch admin tenant row:", fetchErr);
    return;
  }

  const adminTenant = adminRows[0];
  console.log("Fetched admin tenant row from Supabase.");

  console.log("1. Updating client_username on old 'admin' row to temp value...");
  await supabase
    .from('tenants')
    .update({ client_username: 'adminclient_temp' })
    .eq('id', 'admin');

  console.log("2. Inserting new tenant row 't-1005' into `tenants` table...");
  const newTenantRow = {
    ...adminTenant,
    id: 't-1005',
    client_number: '1005',
    client_username: 'adminclient'
  };
  delete newTenantRow.created_at;
  delete newTenantRow.updated_at;

  const { error: insertErr } = await supabase
    .from('tenants')
    .insert(newTenantRow);

  if (insertErr) {
    console.error("❌ Failed to insert new row 't-1005':", insertErr.message);
    // Revert temp username
    await supabase.from('tenants').update({ client_username: 'adminclient' }).eq('id', 'admin');
    return;
  }
  console.log("✅ Successfully inserted row 't-1005' into `tenants` table.");

  // 3. Update dependent tables from 'admin' -> 't-1005'
  const dependentTables = [
    'tenant_configs',
    'chat_messages',
    'customers',
    'appointments',
    'orders',
    'scheduled_follow_ups',
    'revival_campaigns',
    'whatsapp_auth'
  ];

  for (const table of dependentTables) {
    console.log(`Updating tenant_id in \`${table}\` from 'admin' to 't-1005'...`);
    const { error: updateErr } = await supabase
      .from(table)
      .update({ tenant_id: 't-1005' })
      .eq('tenant_id', 'admin');

    if (updateErr) {
      console.error(`❌ Error updating ${table}:`, updateErr.message);
    } else {
      console.log(`✅ Updated ${table} tenant_id to 't-1005'.`);
    }
  }

  // 4. Delete old 'admin' row from `tenants` table
  console.log("4. Deleting old 'admin' row from `tenants` table...");
  const { error: delErr } = await supabase
    .from('tenants')
    .delete()
    .eq('id', 'admin');

  if (delErr) {
    console.error("❌ Failed to delete old 'admin' row:", delErr.message);
  } else {
    console.log("✅ Successfully deleted old 'admin' row from `tenants` table.");
  }

  // 4. Check & rename local auth folder if it exists
  const projectDir = 'c:\\Users\\Hassaan\\hazeldid';
  const oldLocalDir = path.join(projectDir, '.data', '.baileys_auth_admin');
  const newLocalDir = path.join(projectDir, '.data', '.baileys_auth_t-1005');

  if (fs.existsSync(oldLocalDir)) {
    fs.renameSync(oldLocalDir, newLocalDir);
    console.log(`✅ Renamed local auth directory: ${oldLocalDir} -> ${newLocalDir}`);
  } else {
    console.log("ℹ️ No local auth directory `.baileys_auth_admin` found to rename.");
  }

  console.log("\n=======================================================");
  console.log("STEP 4: POST-MIGRATION VERIFICATION");
  console.log("=======================================================");

  const allTables = ['tenants', ...dependentTables];
  const postVerification = {};

  for (const table of allTables) {
    const colName = table === 'tenants' ? 'id' : 'tenant_id';
    
    // Check new ID 't-1005'
    const { count: countNew } = await supabase
      .from(table)
      .select('*', { count: 'exact' })
      .eq(colName, 't-1005');

    // Check old ID 'admin'
    const { count: countOld } = await supabase
      .from(table)
      .select('*', { count: 'exact' })
      .eq(colName, 'admin');

    postVerification[table] = {
      t1005_count: countNew || 0,
      admin_remaining_count: countOld || 0
    };
  }

  console.log("Post-Migration Row Counts:");
  console.log(JSON.stringify(postVerification, null, 2));

  // Test Login HTTP Request for 'adminclient'
  console.log("\nTesting HTTP Login for username 'adminclient':");
  const { POST } = require('../src/app/api/auth/login/route.ts');
  const { NextRequest } = require('next/server');

  const reqObj = new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: 'adminclient',
      password: 'Adm1nCl1ent$2026!',
      remember: true
    })
  });

  const res = await POST(reqObj);
  const status = res.status;
  const body = await res.json();

  console.log(`Login Status Code: ${status}`);
  console.log("Login Response Body:", JSON.stringify(body, null, 2));
}

executeMigration().catch(err => console.error(err));
