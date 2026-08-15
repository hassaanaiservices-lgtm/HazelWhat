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

const url = getEnvKey("NEXT_PUBLIC_SUPABASE_URL") || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hassaanaiservices-lgtm.supabase.co"; // fallback from your org
const key = getEnvKey("SUPABASE_SERVICE_ROLE_KEY") || getEnvKey("NEXT_PUBLIC_SUPABASE_ANON_KEY") || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .order('timestamp', { ascending: true });

  if (error) {
    console.error("Error fetching chats:", error.message);
    return;
  }

  console.log(`Total messages in DB: ${data.length}`);
  console.log("\nSample message details (tenant_id, role, content snippet):");
  data.forEach((m: any) => {
    console.log(`Tenant: ${m.tenant_id} | Role: ${m.role} | Phone: ${m.phone} | Content: "${m.content?.substring(0, 60)}"`);
  });
}

check();
