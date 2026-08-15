const bcrypt = require('bcryptjs');

const supabaseUrl = "https://clsevnbutndjzwtwnbtj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsc2V2bmJ1dG5kanp3dHduYnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NDE0MzQsImV4cCI6MjEwMTQxNzQzNH0.-nKa212NdqR_mU-nh5tDlECSVoMKss2eQFWlGGFZ1dc";

async function run() {
  const username = "pizzabox_hayatabad";
  const password = "PizzaPass2025";

  const hashedPassword = bcrypt.hashSync(password, 10);

  console.log("Sending direct REST request to Supabase...");
  
  const res = await fetch(`${supabaseUrl}/rest/v1/tenants?id=eq.t-1004`, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      client_username: username,
      client_password: hashedPassword,
      status: 'active'
    })
  });

  const data = await res.json();
  console.log("Supabase REST API Response:", data);
}

run().catch(console.error);
