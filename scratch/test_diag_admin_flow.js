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

async function testAdminFlow() {
  const { DB } = require('../src/lib/db.ts');
  
  console.log("\n=======================================================");
  console.log("TESTING ADMIN FLOW: Simulating tenant creation in Admin Panel");
  console.log("=======================================================");

  const existingTenants = await DB.getTenants();
  
  // Simulate admin page creating a new tenant exactly as in page.tsx:481-526
  const newTenantFromAdmin = {
    id: 't-8888',
    clientNumber: '8888',
    name: 'Admin Flow Client',
    businessName: 'Admin Flow Business',
    phoneNumber: '+92 300 1111111',
    email: 'adminflow@business.com',
    status: 'active',
    installationFee: 50000,
    monthlySubscriptionFee: 15000,
    currency: 'PKR',
    paymentStatus: 'paid',
    allocatedMinutes: 800,
    usedMinutes: 0,
    clientUsername: 'adminflow_888',
    clientPassword: 'HazelPass@8888',
    systemPrompt: 'AI prompt',
    knowledgeBase: 'KB details',
    productKnowledgeBase: 'Product catalog',
    followupMechanism: 'Voice note',
    llmModel: 'gpt-4o-mini',
    temperature: 0.7,
    deepgramVoice: 'aura-asteria-en',
    deepgramApiKey: '',
    openaiApiKey: '',
    omnivoiceApiKey: '',
    omnivoiceNumber: '+1 555 1234',
    createdAt: new Date().toISOString(),
    troubleshoot: {
      webhookConnected: true,
      deepgramApiValid: true,
      llmApiValid: true,
      whatsappSessionActive: true,
      serviceBlocked: false,
    },
    promotionsSent: 0,
    revivalLeadsActive: 0,
    conversationalLeadsCount: 0,
  };

  const updatedTenantsList = [newTenantFromAdmin, ...existingTenants];

  // Call DB.saveTenantsAsync as POST /api/admin/tenants does
  console.log("Saving tenants via DB.saveTenantsAsync...");
  const saveSuccess = await DB.saveTenantsAsync(updatedTenantsList);
  console.log(`DB.saveTenantsAsync result: ${saveSuccess}`);

  // Query Supabase directly for this newly saved tenant
  console.log("\nQuerying Supabase directly for 'adminflow_888':");
  const { data: dbRows, error: dbErr } = await supabase
    .from('tenants')
    .select('id, client_username, client_password, status')
    .eq('client_username', 'adminflow_888');

  console.log("Supabase direct query result:");
  console.log(JSON.stringify(dbRows, null, 2));

  // Test getTenantByUsername
  console.log("\nTesting DB.getTenantByUsername('adminflow_888'):");
  const fetchedTenant = await DB.getTenantByUsername('adminflow_888');
  console.log("DB.getTenantByUsername returned tenant:", fetchedTenant ? { id: fetchedTenant.id, clientUsername: fetchedTenant.clientUsername, clientPassword: fetchedTenant.clientPassword } : "NULL");

  // Test login with matching password vs lowercase password vs trailing space
  if (fetchedTenant) {
    const bcrypt = require('bcryptjs');
    const inputPass = 'HazelPass@8888';
    const storedPass = (fetchedTenant.clientPassword || '').trim();
    const isBcrypt = storedPass.startsWith("$2a$") || storedPass.startsWith("$2b$") || storedPass.startsWith("$2y$");

    console.log(`\nTesting Password Comparison: storedPass="${storedPass}", inputPass="${inputPass}", isBcrypt=${isBcrypt}`);
    let passMatches = isBcrypt ? bcrypt.compareSync(inputPass, storedPass) : (!!storedPass && (inputPass === storedPass || inputPass.toLowerCase() === storedPass.toLowerCase()));
    console.log(`Match Result: ${passMatches ? 'SUCCESS (200)' : 'FAILED (401)'}`);
  }

  // Clean up test record
  await supabase.from('tenants').delete().eq('id', 't-8888');
}

testAdminFlow().catch(err => console.error(err));
