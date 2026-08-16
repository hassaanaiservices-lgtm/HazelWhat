const fs = require('fs');
const content = fs.readFileSync('src/app/client/page.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('revival') || line.toLowerCase().includes('campaign')) {
    console.log(`Line ${idx + 1}: ${line.trim().substring(0, 120)}`);
  }
});
