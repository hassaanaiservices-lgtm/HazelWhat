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
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('recovery_stage') || content.includes('recoveryStage')) {
        console.log(`Match in migration file: ${fullPath}`);
      }
    }
  });
}

search('supabase');
