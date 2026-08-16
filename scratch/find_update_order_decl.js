const fs = require('fs');
const content = fs.readFileSync('src/lib/db.ts', 'utf8');
const lines = content.split('\n');

let startLine = -1;
lines.forEach((line, idx) => {
  if (line.includes('static async updateOrder')) {
    startLine = idx + 1;
  }
});

if (startLine !== -1) {
  console.log(lines.slice(startLine - 2, startLine + 35).join('\n'));
} else {
  console.log("Not found");
}
