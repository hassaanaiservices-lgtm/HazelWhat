import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
      const idx = line.indexOf("=");
      if (idx > 0) process.env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
    }
  }
}
loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

function isBase64(val: string): boolean {
  return !!(val && (val.startsWith("data:") || val.includes(";base64,") || val.length > 500));
}

async function run() {
  const { data: tenants } = await supabase.from("tenants").select("id, name, products");
  if (!tenants) { console.error("No tenants found"); return; }
  for (const tenant of tenants) {
    const products: any[] = tenant.products || [];
    let count = 0;
    const cleaned = products.map((p: any) => {
      if (p.image && isBase64(p.image)) { count++; console.log(`  Cleaning: "${p.title}" (${p.image.length} chars)`); return { ...p, image: "" }; }
      return p;
    });
    if (count > 0) {
      const { error } = await supabase.from("tenants").update({ products: cleaned }).eq("id", tenant.id);
      console.log(error ? `ERROR: ${error.message}` : `SUCCESS: Cleaned ${count} images for ${tenant.name} (${tenant.id})`);
    } else {
      console.log(`OK: ${tenant.name} (${tenant.id}) - no base64 images`);
    }
  }
  console.log("Done!");
}
run().catch(console.error);
