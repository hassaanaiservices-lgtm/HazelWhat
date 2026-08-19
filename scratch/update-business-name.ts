import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Manually parse .env
const envPath = path.join(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars: Record<string, string> = {};
envContent.split("\n").forEach(line => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    envVars[parts[0].trim()] = parts.slice(1).join("=").trim();
  }
});

const url = envVars.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  console.log("Updating tenant t-1002 business name to 'Pizza Box'...");

  // Update tenants table
  const { error: tErr } = await supabase
    .from("tenants")
    .update({ business_name: "Pizza Box", name: "Pizza Box" })
    .eq("id", "t-1002");

  if (tErr) {
    console.error("Failed to update tenants table:", tErr.message);
  } else {
    console.log("Successfully updated tenants table.");
  }

  // Update tenant_configs table
  const { error: cErr } = await supabase
    .from("tenant_configs")
    .update({ business_name: "Pizza Box" })
    .eq("tenant_id", "t-1002");

  if (cErr) {
    console.error("Failed to update tenant_configs table:", cErr.message);
  } else {
    console.log("Successfully updated tenant_configs table.");
  }
}

main();
