import { AsyncLocalStorage } from 'async_hooks';
import { handleWhatsAppMessage } from '../src/lib/ai-handler';
import { DB } from '../src/lib/db';
import { WhatsAppManager } from '../src/lib/whatsapp';

const asyncLocalStorage = new AsyncLocalStorage<string>();

// Mock DB and WhatsAppManager methods
DB.getCustomer = async (phone: string) => {
  return { tenantId: 't-1001', phone, name: 'Test Customer' };
};
DB.getTenants = async () => {
  return [{ id: 't-1001', currency: 'PKR', name: 'Test Tenant', installationFee: 0, monthlySubscriptionFee: 0 } as any];
};
DB.getChats = async (phone: string) => {
  return [];
};
DB.addChatMessage = async (phone: string, msg: any) => {};

WhatsAppManager.getActiveTenantId = () => 't-1001';
WhatsAppManager.sendMessage = async (phone: string, text: string) => {
  console.log(`[Mock WhatsApp] Message sent to ${phone}: "${text.substring(0, 50)}"`);
  return { key: { id: 'mock_sent_id' } };
};

// Override global fetch to mock LLM calls and record timing
const callLogs2: { phone: string; event: 'start' | 'end'; time: number }[] = [];
const originalFetch = global.fetch;

(global as any).fetch = async (url: any, init?: any) => {
  const urlString = String(url || '');
  if (urlString.includes('api.deepseek.com') || urlString.includes('api.anthropic.com') || urlString.includes('api.openai.com')) {
    const phone = asyncLocalStorage.getStore() || 'unknown';

    callLogs2.push({ phone, event: 'start', time: Date.now() });
    await new Promise(resolve => setTimeout(resolve, 300));
    callLogs2.push({ phone, event: 'end', time: Date.now() });

    const payload = {
      id: "mock_response",
      content: [{ type: 'text', text: `Hello from Mock LLM for ${phone}` }],
      choices: [{ message: { content: `Hello from Mock LLM for ${phone}` } }]
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }
  return originalFetch(url, init);
};

async function execute() {
  console.log("=== STARTING SERIALIZATION TESTS ===");

  // Test Case 1: Same Phone Number (Must serialize)
  console.log("\n--- TEST CASE 1: Same Phone Number (Serialization) ---");
  const phone1 = "1234567890";
  
  const p1 = asyncLocalStorage.run(phone1, () => handleWhatsAppMessage({
    key: { remoteJid: `${phone1}@s.whatsapp.net`, id: "msg1" },
    message: { conversation: `Message 1 for ${phone1}` }
  }, 't-1001'));

  await new Promise(resolve => setTimeout(resolve, 50)); // Msg 2 arrives 50ms later

  const p2 = asyncLocalStorage.run(phone1, () => handleWhatsAppMessage({
    key: { remoteJid: `${phone1}@s.whatsapp.net`, id: "msg2" },
    message: { conversation: `Message 2 for ${phone1}` }
  }, 't-1001'));

  await Promise.all([p1, p2]);

  // Validate Case 1 timings
  const logs1 = callLogs2.filter(l => l.phone === phone1);
  console.log("Logs for phone1:", logs1);
  if (logs1.length === 4) {
    const [startCall1, endCall1, startCall2, endCall2] = logs1;
    if (startCall2.time >= endCall1.time) {
      console.log("✅ Msg 2 did not start until Msg 1 finished. Serialization SUCCESS!");
    } else {
      console.error("❌ Msg 2 started before Msg 1 finished. Serialization FAILED!");
      process.exit(1);
    }
  } else {
    console.error("❌ Log counts mismatch for Case 1. Expected 4 events, got:", logs1.length);
    process.exit(1);
  }

  // Clear logs for next test
  callLogs2.length = 0;

  // Test Case 2: Different Phone Numbers (Must run concurrently)
  console.log("\n--- TEST CASE 2: Different Phone Numbers (Concurrency) ---");
  const phoneA = "1111111111";
  const phoneB = "2222222222";
  
  const pA = asyncLocalStorage.run(phoneA, () => handleWhatsAppMessage({
    key: { remoteJid: `${phoneA}@s.whatsapp.net`, id: "msgA" },
    message: { conversation: `Message A for ${phoneA}` }
  }, 't-1001'));

  const pB = asyncLocalStorage.run(phoneB, () => handleWhatsAppMessage({
    key: { remoteJid: `${phoneB}@s.whatsapp.net`, id: "msgB" },
    message: { conversation: `Message B for ${phoneB}` }
  }, 't-1001'));

  await Promise.all([pA, pB]);

  console.log("Logs for different phones:", callLogs2);
  const startA = callLogs2.find(l => l.phone === phoneA && l.event === 'start')?.time || 0;
  const startB = callLogs2.find(l => l.phone === phoneB && l.event === 'start')?.time || 0;
  const endA = callLogs2.find(l => l.phone === phoneA && l.event === 'end')?.time || 0;
  const endB = callLogs2.find(l => l.phone === phoneB && l.event === 'end')?.time || 0;

  if (startB < endA && startA < endB) {
    console.log("✅ Message A and Message B were processed concurrently. Concurrency SUCCESS!");
  } else {
    console.error("❌ Message A and Message B did not run concurrently. Concurrency FAILED!");
    process.exit(1);
  }

  // Clear logs
  callLogs2.length = 0;

  // Test Case 3: Error Recovery (Failing message doesn't block queue)
  console.log("\n--- TEST CASE 3: Error Recovery ---");
  const phoneErr = "9999999999";

  // Stub DB.getCustomer to throw error for Msg 1
  let shouldFail = true;
  const originalGetCustomer = DB.getCustomer;
  DB.getCustomer = async (phone: string) => {
    if (phone === phoneErr && shouldFail) {
      shouldFail = false;
      throw new Error("Simulated database failure");
    }
    return { tenantId: 't-1001', phone, name: 'Test Customer' };
  };

  const pErr1 = asyncLocalStorage.run(phoneErr, () => handleWhatsAppMessage({
    key: { remoteJid: `${phoneErr}@s.whatsapp.net`, id: "msgErr1" },
    message: { conversation: `Message 1 for ${phoneErr}` }
  }, 't-1001'));

  await new Promise(resolve => setTimeout(resolve, 50));

  const pErr2 = asyncLocalStorage.run(phoneErr, () => handleWhatsAppMessage({
    key: { remoteJid: `${phoneErr}@s.whatsapp.net`, id: "msgErr2" },
    message: { conversation: `Message 2 for ${phoneErr}` }
  }, 't-1001'));

  await Promise.all([pErr1, pErr2]);
  DB.getCustomer = originalGetCustomer; // Restore

  console.log("Logs for error recovery:", callLogs2);
  const successLog = callLogs2.filter(l => l.phone === phoneErr);
  if (successLog.length === 2) {
    console.log("✅ Succeeding Message completed after the failing message failed. Error Recovery SUCCESS!");
  } else {
    console.error("❌ Succeeding Message failed to process after error. Error Recovery FAILED!");
    process.exit(1);
  }

  console.log("\n=== ALL TESTS PASSED SUCCESSFULLY ===");
  process.exit(0);
}

execute().catch(e => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
