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

async function runCleanup() {
  console.log("Running SQL migration to clean empty client_username strings in Supabase...");
  // Set any empty string client_username to null via RPC or direct update
  const { data, error } = await supabase
    .from('tenants')
    .update({ client_username: null })
    .eq('client_username', '');

  if (error) {
    console.error("Cleanup error:", error.message);
  } else {
    console.log("✅ Cleanup update finished:", data);
  }
}

runCleanup().catch(err => console.error(err));
