import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabaseUrl = "https://clsevnbutndjzwtwnbtj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsc2V2bmJ1dG5kanp3dHduYnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NDE0MzQsImV4cCI6MjEwMTQxNzQzNH0.-nKa212NdqR_mU-nh5tDlECSVoMKss2eQFWlGGFZ1dc";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const username = "pizzabox_hayatabad";
  const password = "PizzaPass2025";

  // Hash password with bcrypt
  const hashedPassword = bcrypt.hashSync(password, 10);

  console.log("Updating tenant t-1004 in Supabase...");
  const { data, error } = await supabase
    .from('tenants')
    .update({
      client_username: username,
      client_password: hashedPassword,
      status: 'active'
    })
    .eq('id', 't-1004')
    .select();

  if (error) {
    console.error("Update failed:", error);
  } else {
    console.log("SUCCESS! Updated tenant in Supabase:", data);
  }
}

run();
