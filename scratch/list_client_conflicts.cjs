const fs = require('fs');
const content = fs.readFileSync('src/app/client/page.tsx', 'utf8');
const lines = content.split('\n');
console.log("All conflict markers in client/page.tsx:");
lines.forEach((line, index) => {
  if (line.startsWith('<<<<<<<') || line.startsWith('=======') || line.startsWith('>>>>>>>')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
