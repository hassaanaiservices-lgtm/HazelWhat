const { execSync } = require('child_process');

try {
  const content = execSync('git show origin/main:src/app/client/page.tsx', { maxBuffer: 10 * 1024 * 1024 }).toString();
  const lines = content.split('\n');
  console.log("Printing lines 4985 to 5060 of origin/main:src/app/client/page.tsx:");
  for (let i = 4984; i < 5060; i++) {
    if (lines[i]) {
      console.log(`${i + 1}: ${lines[i]}`);
    }
  }
} catch (e) {
  console.error("Error:", e.message);
}
