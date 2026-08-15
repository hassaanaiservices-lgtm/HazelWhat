const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase credentials not found in env!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTenants() {
  console.log("=== FETCHING TENANTS FROM SUPABASE ===");
  const { data, error } = await supabase.from('tenants').select('id, name, client_number, client_username, client_password, status');
  if (error) {
    console.error("Error fetching tenants:", error);
    process.exit(1);
  }
  console.log("Tenants found:", JSON.stringify(data, null, 2));
  process.exit(0);
}

checkTenants().catch(err => {
  console.error("Exception:", err);
  process.exit(1);
});
