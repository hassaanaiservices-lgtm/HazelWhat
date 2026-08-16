const fs = require('fs');
const path = require('path');

function search(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(f => {
    const fullPath = path.join(dir, f);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      search(fullPath);
    } else {
      if (f.toLowerCase().includes('revival') || fullPath.toLowerCase().includes('revival')) {
        console.log(`Found: ${fullPath}`);
      }
    }
  });
}

search('src');
