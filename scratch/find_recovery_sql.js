const fs = require('fs');
const content = fs.readFileSync('supabase/migrations/20260806000000_full_supabase_schema.sql', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('recovery_stage') || line.includes('orders')) {
    console.log(`Line ${idx + 1}: ${line.trim().substring(0, 120)}`);
  }
});
