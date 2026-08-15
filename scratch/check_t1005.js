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

async function check1005() {
  const { data: tData } = await supabase.from('tenants').select('id').eq('id', 't-1005');
  const { data: cData } = await supabase.from('tenant_configs').select('tenant_id').eq('tenant_id', 't-1005');
  console.log("Check t-1005 in tenants table:", tData);
  console.log("Check t-1005 in tenant_configs table:", cData);
}

check1005().catch(err => console.error(err));
