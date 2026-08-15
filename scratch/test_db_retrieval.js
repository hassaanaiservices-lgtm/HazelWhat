const fs = require('fs');
const path = require('path');

function loadEnv(envPath) {
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2 && !line.startsWith('#')) {
        const key = parts[0].trim();
        let val = parts.slice(1).join('=').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    });
  }
}

loadEnv('c:\\Users\\Hassaan\\Music\\Hazelwhat.1\\.env.local');

// We need to test DB.getTenantById and DB.getConfig
// Let's import TS using ts-node or run via node if compiled, or register ts-node
require('ts-node').register({ transpileOnly: true });

const { DB } = require('../src/lib/db.ts');

async function testRetrieval() {
  console.log("=== TESTING TENANT & CONFIG RETRIEVAL FOR REAL TENANTS ===");
  const testIds = ['t-1004', 't-1001', 't-1002', 't-1003', '00000000-0000-0000-0000-000000000001'];
  
  for (const tid of testIds) {
    console.log(`\n-----------------------------------------`);
    console.log(`Testing resolvedTenantId: "${tid}"`);
    const tenant = await DB.getTenantById(tid);
    console.log(`DB.getTenantById("${tid}") returned:`, tenant ? {
      id: tenant.id,
      name: tenant.name,
      businessName: tenant.businessName,
      knowledgeBaseLength: (tenant.knowledgeBase || '').length,
      knowledgeBasePreview: (tenant.knowledgeBase || '').substring(0, 150),
      productKBPreview: (tenant.productKnowledgeBase || '').substring(0, 150),
    } : null);

    const config = await DB.getConfig(tid);
    console.log(`DB.getConfig("${tid}") returned:`, {
      businessName: config.businessName,
      productInfoLength: (config.productInfo || '').length,
      productInfoPreview: (config.productInfo || '').substring(0, 150),
      systemPromptPreview: (config.systemPrompt || '').substring(0, 150),
    });
  }
}

testRetrieval().catch(err => console.error(err));
