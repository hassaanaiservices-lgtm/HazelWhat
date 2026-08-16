const fs = require('fs');
const content = fs.readFileSync('src/lib/db.ts', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('recoveryStage') || line.includes('recovery_stage')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
