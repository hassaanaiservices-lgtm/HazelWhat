const { execSync } = require('child_process');

try {
  const content = execSync('git show origin/main:src/lib/ai-handler.ts', { maxBuffer: 10 * 1024 * 1024 }).toString();
  const lines = content.split('\n');
  console.log("Printing lines 1888 to 1957 of remote src/lib/ai-handler.ts:");
  for (let i = 1887; i <= 1957; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
} catch (e) {
  console.error("Error:", e.message);
}
