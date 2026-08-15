const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv(envPath) {
  if (fs.existsSync(envPath)) {
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
  }
}

loadEnv('c:\\Users\\Hassaan\\Music\\Hazelwhat.1\\.env.local');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase credentials missing!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSqlExecution() {
  console.log("=== TESTING SQL EXECUTION ON SUPABASE ===");
  // Check if we can run query or exec_sql
  const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1;' });
  if (error) {
    console.log("RPC exec_sql error:", error.message);
  } else {
    console.log("RPC exec_sql success:", data);
  }
}

testSqlExecution().catch(err => console.error(err));
