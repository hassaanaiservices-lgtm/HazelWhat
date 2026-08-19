const { execSync } = require('child_process');

try {
  const content = execSync('git show origin/main:src/lib/ai-handler.ts', { maxBuffer: 10 * 1024 * 1024 }).toString();
  const lines = content.split('\n');
  
  console.log("Searching for 'filterRelevantProducts' in remote ai-handler.ts:");
  lines.forEach((line, index) => {
    if (line.includes('filterRelevantProducts')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });

  // Let's find where filterRelevantProducts is defined
  const definitionLineIndex = lines.findIndex(line => line.includes('function filterRelevantProducts'));
  if (definitionLineIndex !== -1) {
    console.log(`\nDefinition found on line ${definitionLineIndex + 1}:`);
    for (let i = definitionLineIndex; i <= definitionLineIndex + 30; i++) {
      console.log(`  ${i + 1}: ${lines[i]}`);
    }
  }
} catch (e) {
  console.error("Error:", e.message);
}
