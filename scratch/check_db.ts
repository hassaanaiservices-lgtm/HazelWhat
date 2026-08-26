import fs from 'fs';
import path from 'path';

// Parse .env manually BEFORE importing any DB client
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const firstEquals = trimmed.indexOf('=');
    if (firstEquals !== -1) {
      const key = trimmed.substring(0, firstEquals).trim();
      const val = trimmed.substring(firstEquals + 1).trim();
      process.env[key] = val;
    }
  }
}

async function main() {
  const { supabase } = await import('../src/lib/db');
  if (!supabase) {
    console.error("Supabase client is null!");
    return;
  }
  
  const { data, error } = await supabase
    .from('tenant_configs')
    .select('api_key')
    .limit(1);

  if (error) {
    console.log("Columns do NOT exist! Error details:", error.message);
  } else {
    console.log("Columns exist! Table is ready.");
  }
}

main();
