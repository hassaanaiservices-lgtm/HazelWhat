const fs = require('fs');
const content = fs.readFileSync('src/lib/db.ts', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('updateOrder') && !line.includes('updateOrderStatus') && !line.includes('updateOrder(')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
  if (line.includes('updateOrder(')) {
    console.log(`Line ${idx + 1} (match): ${line.trim()}`);
  }
});
