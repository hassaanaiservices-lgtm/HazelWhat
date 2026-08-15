const { createClient } = require('@supabase/supabase-js');

const db1Url = 'https://clsevnbutndjzwtwnbtj.supabase.co';
const db1Key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsc2V2bmJ1dG5kanp3dHduYnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NDE0MzQsImV4cCI6MjEwMTQxNzQzNH0.-nKa212NdqR_mU-nh5tDlECSVoMKss2eQFWlGGFZ1dc';

const supabase = createClient(db1Url, db1Key);

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
  }
];

async function runTest() {
  console.log("=== DB1 INSERT TEST ===");
  for (const t of TENANTS_SEED) {
    const { data, error } = await supabase.from('tenants').upsert(t, { onConflict: 'id' });
    console.log(`Tenant ${t.id} insert:`, { error: error?.message || 'SUCCESS' });
  }

  const { data: allTenants, error: fetchErr } = await supabase.from('tenants').select('*');
  console.log("\nFetched tenants from DB1:", allTenants);
}

runTest().catch(err => console.error(err));
