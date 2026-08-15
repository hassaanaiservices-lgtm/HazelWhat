const { createClient } = require('@supabase/supabase-js');

const db1Url = 'https://clsevnbutndjzwtwnbtj.supabase.co';
const db1Key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsc2V2bmJ1dG5kanp3dHduYnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NDE0MzQsImV4cCI6MjEwMTQxNzQzNH0.-nKa212NdqR_mU-nh5tDlECSVoMKss2eQFWlGGFZ1dc';

const db2Url = 'https://ynocyenhftcezxypqmiu.supabase.co';
const db2Key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlub2N5ZW5oZnRjZXp4eXBxbWl1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY4MDI2OCwiZXhwIjoyMTAyMjU2MjY4fQ.ljHu0cJEjipxdPTIbV2ftJSykCaxsPFrWvLk2AIYZUg';

async function checkBoth() {
  console.log("=== CHECKING DB 1: clsevnbutndjzwtwnbtj.supabase.co ===");
  const sb1 = createClient(db1Url, db1Key);
  const { data: t1, error: err1 } = await sb1.from('tenants').select('*').eq('id', 't-1004');
  console.log("DB1 tenants.id = 't-1004':", { data: t1, error: err1?.message });

  console.log("\n=== CHECKING DB 2: ynocyenhftcezxypqmiu.supabase.co ===");
  const sb2 = createClient(db2Url, db2Key);
  const { data: t2, error: err2 } = await sb2.from('tenants').select('*').eq('id', 't-1004');
  console.log("DB2 tenants.id = 't-1004':", { data: t2, error: err2?.message });
}

checkBoth().catch(err => console.error(err));
