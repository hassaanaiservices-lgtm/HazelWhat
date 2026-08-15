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

async function inspectTenants() {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, client_number, name, business_name, client_username, client_password, status');

  console.log("=== PART A STEP 1: CURRENT TENANTS IN SUPABASE ===");
  if (error) {
    console.error("Error:", error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

inspectTenants().catch(err => console.error(err));
