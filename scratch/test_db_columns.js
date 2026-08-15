const { createClient } = require('@supabase/supabase-js');

const db1Url = 'https://clsevnbutndjzwtwnbtj.supabase.co';
const db1Key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsc2V2bmJ1dG5kanp3dHduYnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NDE0MzQsImV4cCI6MjEwMTQxNzQzNH0.-nKa212NdqR_mU-nh5tDlECSVoMKss2eQFWlGGFZ1dc';

const db2Url = 'https://ynocyenhftcezxypqmiu.supabase.co';
const db2ServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlub2N5ZW5oZnRjZXp4eXBxbWl1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY4MDI2OCwiZXhwIjoyMTAyMjU2MjY4fQ.ljHu0cJEjipxdPTIbV2ftJSykCaxsPFrWvLk2AIYZUg';

async function testColumns() {
  console.log("=== DB1 (clsevnbutndjzwtwnbtj) ===");
  const sb1 = createClient(db1Url, db1Key);
  const { data: d1, error: e1 } = await sb1.from('tenants').select('*').limit(1);
  console.log("DB1 tenants query:", { data: d1, error: e1?.message });

  console.log("\n=== DB2 (ynocyenhftcezxypqmiu - Service Role) ===");
  const sb2 = createClient(db2Url, db2ServiceKey);
  const { data: d2, error: e2 } = await sb2.from('tenants').select('*').limit(1);
  console.log("DB2 tenants query:", { data: d2, error: e2?.message });
}

testColumns().catch(err => console.error(err));
