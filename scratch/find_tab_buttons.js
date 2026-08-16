const fs = require('fs');
const content = fs.readFileSync('src/app/client/page.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('leads-revival') && (line.includes('Tab') || line.includes('button') || line.includes('onClick'))) {
    console.log(`Line ${idx + 1}: ${line.trim().substring(0, 150)}`);
  }
});
