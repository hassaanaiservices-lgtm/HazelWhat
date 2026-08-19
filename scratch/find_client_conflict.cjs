const fs = require('fs');
const content = fs.readFileSync('src/app/client/page.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.startsWith('<<<<<<<') || line.startsWith('=======') || line.startsWith('>>>>>>>')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
    console.log("--- CONTEXT ---");
    for (let i = Math.max(0, index - 15); i <= Math.min(lines.length - 1, index + 20); i++) {
      console.log(`  ${i + 1}: ${lines[i]}`);
    }
    console.log("---------------\n");
  }
});
