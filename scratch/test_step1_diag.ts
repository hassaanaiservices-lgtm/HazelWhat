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

async function runStep1Diag() {
  const { DB } = require('../src/lib/db.ts');

  console.log("\n=======================================================");
  console.log("STEP 1 REAL EVIDENCE: DB calls invoked WITHOUT tenantId");
  console.log("=======================================================");

  const pendingSystemAFollowUps = await DB.getPendingFollowUps();
  const chats = await DB.getAllChats();
  const orders = await DB.getOrders();
  const pendingOrders = orders.filter((o: any) => o.status === "pending");

  console.log(`[STEP 1 DIAG LOG] pendingSystemAFollowUps count: ${pendingSystemAFollowUps.length}`);
  console.log(`[STEP 1 DIAG LOG] stillPendingSystemA count: ${pendingSystemAFollowUps.length}`);
  console.log(`[STEP 1 DIAG LOG] chats count (keys): ${Object.keys(chats).length}`);
  console.log(`[STEP 1 DIAG LOG] orders count: ${orders.length}, pendingOrders count: ${pendingOrders.length}`);
}

runStep1Diag().catch(err => console.error(err));
