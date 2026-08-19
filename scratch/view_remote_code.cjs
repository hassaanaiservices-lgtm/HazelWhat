const { execSync } = require('child_process');

try {
  const content = execSync('git show origin/main:src/lib/ai-handler.ts', { maxBuffer: 10 * 1024 * 1024 }).toString();
  const lines = content.split('\n');
  
  console.log("Searching for 'RAG' or 'Smart Product' in remote ai-handler.ts:");
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes('rag') || line.toLowerCase().includes('slicing') || line.toLowerCase().includes('sst') || line.toLowerCase().includes('transcri')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
      // Print surrounding context
      console.log("--- CONTEXT ---");
      for (let i = Math.max(0, index - 5); i <= Math.min(lines.length - 1, index + 10); i++) {
        console.log(`  ${i + 1}: ${lines[i]}`);
      }
      console.log("---------------\n");
    }
  });
} catch (e) {
  console.error("Error:", e.message);
}
