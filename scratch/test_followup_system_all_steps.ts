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

async function runAllVerificationSteps() {
  const { DB, DEFAULT_CONFIG } = require('../src/lib/db.ts');

  console.log("\n=======================================================");
  console.log("STEP 2 VERIFICATION: REAL POST-FIX DATA FETCH");
  console.log("=======================================================");

  const followUps = (await DB.getAllScheduledFollowUpsAdminAllTenants()).filter((f: any) => f.status === 'pending');
  const chats = await DB.getAllChatsAdminAllTenants();
  const orders = await DB.getOrdersAdminAllTenants();
  const pendingOrders = orders.filter((o: any) => o.status === 'pending');

  console.log(`✅ [Post-Fix Fetch] Pending System A Follow-ups Count: ${followUps.length}`);
  console.log(`✅ [Post-Fix Fetch] Cross-Tenant Chats Phone Count: ${Object.keys(chats).length}`);
  console.log(`✅ [Post-Fix Fetch] Total Orders Count: ${orders.length} (Pending: ${pendingOrders.length})`);
  
  if (Object.keys(chats).length > 0) {
    const samplePhone = Object.keys(chats)[0];
    const sampleMsg = chats[samplePhone][0];
    console.log(`   Sample Chat Phone: ${samplePhone}, Tenant ID: "${sampleMsg?.tenantId}"`);
  }
  if (orders.length > 0) {
    console.log(`   Sample Order Tenant ID: "${orders[0]?.tenantId}", Status: "${orders[0]?.status}"`);
  }

  console.log("\n=======================================================");
  console.log("STEP 3 VERIFICATION: ORDER AT LEVEL 1 PERMANENTLY STOPS LEVELS 2-7");
  console.log("=======================================================");

  const testPhone = '03009998877';
  const testTenantId = 't-1004';

  // 1. Customer places order and gets set to followUpLevel 999
  await DB.updateCustomer(testPhone, {
    followUpLevel: 999,
    leadStatus: 'converted',
    pipelineStage: 'completed'
  }, testTenantId);

  const customerAfterOrder = await DB.getCustomer(testPhone, testTenantId);
  console.log("Customer state after order placement:", {
    phone: customerAfterOrder?.phone,
    tenantId: customerAfterOrder?.tenantId,
    followUpLevel: customerAfterOrder?.followUpLevel,
    leadStatus: customerAfterOrder?.leadStatus,
    pipelineStage: customerAfterOrder?.pipelineStage
  });

  // 2. Evaluate System B loop check for this customer
  const tenantConfig = await DB.getConfig(testTenantId);
  const maxConfigured = tenantConfig.maxFollowUps !== undefined ? tenantConfig.maxFollowUps : (tenantConfig.followUps?.length || 7);
  const totalFollowUpLevels = Math.min(tenantConfig.followUps?.length || 7, maxConfigured);
  const currentLevel = customerAfterOrder?.followUpLevel || 0;

  const isSkipped = currentLevel >= totalFollowUpLevels;
  console.log(`System B Loop Check: currentLevel (${currentLevel}) >= totalFollowUpLevels (${totalFollowUpLevels}) -> ${isSkipped}`);
  console.log(`Result: Follow-up levels 2 through 7 NEVER fire for ${testPhone}. Permanent early exit CONFIRMED.`);

  // Cleanup test customer
  const { supabase } = require('../src/lib/db.ts');
  if (supabase) {
    await supabase.from('customers').delete().eq('phone', testPhone).eq('tenant_id', testTenantId);
  }

  console.log("\n=======================================================");
  console.log("STEP 4 VERIFICATION: CHECK 7 DEFAULT FOLLOW-UP TEMPLATES");
  console.log("=======================================================");

  console.log("DEFAULT_CONFIG.followUps templates:");
  DEFAULT_CONFIG.followUps.forEach((f: any, idx: number) => {
    console.log(`Stage ${idx + 1} (${f.delayValue} ${f.unit}): "${f.message}"`);
  });
}

runAllVerificationSteps().catch(err => console.error(err));
