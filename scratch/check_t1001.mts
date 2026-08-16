import { createClient } from "@supabase/supabase-js";
import path from 'path';
import fs from 'fs';

function getEnvKey(keyName: string): string {
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const parts = line.split("=");
        if (parts[0]?.trim() === keyName) {
          let val = parts.slice(1).join("=").trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          return val;
        }
      }
    }
  } catch (e) {}
  return "";
}

const url = getEnvKey("NEXT_PUBLIC_SUPABASE_URL") || "https://hassaanaiservices-lgtm.supabase.co"; 
const key = getEnvKey("SUPABASE_SERVICE_ROLE_KEY") || getEnvKey("NEXT_PUBLIC_SUPABASE_ANON_KEY") || "";

const supabase = createClient(url, key);

async function check() {
  const { data: tenantConfig, error: err1 } = await supabase
    .from('tenant_configs')
    .select('*')
    .eq('tenant_id', 't-1001')
    .single();

  const { data: tenant, error: err2 } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', 't-1001')
    .single();

  console.log("tenant_configs (t-1001):", JSON.stringify(tenantConfig, null, 2));
  console.log("tenants (t-1001):", JSON.stringify(tenant, null, 2));
}

check();
