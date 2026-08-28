#!/usr/bin/env node
/**
 * HazelWhat 200-Customer Load Test
 * 
 * Simulates 200 concurrent customers sending various messages:
 * - Orders (single items, multiple items, mixed dishes)
 * - Complaints (bad order, late delivery, wrong item)
 * - Menu inquiries
 * - Greetings / general chat
 * - Follow-up questions
 * - Opt-out requests
 * 
 * Reports: response latency, order creation, complaint detection, failures
 * 
 * Run: node --experimental-strip-types scripts/load-test-200.ts
 * OR:  npx tsx scripts/load-test-200.ts
 */

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const COOKIE = process.env.TEST_COOKIE || ""; // Set hazel_client_session cookie value here
const CONCURRENCY_BATCH = 20;   // Send in batches of 20 to avoid overwhelming
const TOTAL_CUSTOMERS = 200;
const RESULTS_WAIT_MS = 45_000; // Wait 45s for AI to process all messages

// ─── Test Scenarios ──────────────────────────────────────────────────────────

const FOOD_ORDERS = [
  "Ek Smokey Zinger Burger chahiye, ghar pe delivery karo",
  "2 Gourmet Pepperoni Pizza Medium aur 3 Chilled Mint Margarita order karna hai",
  "Mujhe 1 Smokey Zinger aur 1 Gourmet Pepperoni Small chahiye",
  "Ek Zinger Burger order karna chahta hun, address hai Model Town Lahore",
  "3 burgers aur 2 drinks order karna hai, total batao",
  "Menu dikhaao pls, kya kya hai?",
  "Kya pizza available hai? Medium size ka price kya hai?",
  "1 family meal deal chahiye, kya hai options?",
  "Mera address save karo: House 45 Johar Town, order start karo",
  "Chicken burger order karna hai, cod payment chalega?",
  "2x Large pizza order chahiye, delivery time kya hai?",
  "Aaj special kya hai? Koi deal hai?",
  "Combo meal chahiye, sab se sasta wala batao",
  "Order karna hai: 4 Smokey Zinger, 2 fries, 4 drinks",
  "Breakfast available hai? Kya offer hai?",
];

const COMPLAINT_MESSAGES = [
  "Mera order bohot late aaya, 2 ghante ho gaye, yeh service kharab hai!",
  "Order galat aaya tha, mene chicken order kiya tha, beef mila",
  "Pizza tuta hua mila, packaging bekar thi, complaint karna chahta hun",
  "Delivery wala rude tha, aur food bhi thanda tha, refund chahiye",
  "Mera order abhi tak nahi aaya, 3 ghante ho gaye, fraud lag raha hai",
  "Food khraab tha, quality bekar thi, shikayat darj karna chahta hun",
  "Wrong item deliver hua, replacement chahiye ya wapas paise do",
  "Order mein item missing tha, koi chips nahi thi, complaint hai meri",
  "Delivery boy ne phone nahi uthaya, order status naqis hai",
  "Mera order missing hai, payment ho gayi lekin kuch nahi mila",
];

const GENERAL_INQUIRIES = [
  "Hello! Kya aap ka restaurant open hai?",
  "Assalam o alaikum! Menu share karo please",
  "Bhai delivery charges kya hain?",
  "Kya home delivery hoti hai?",
  "Working hours kya hain apke?",
  "Loyalty points system hai koi?",
  "Payment kaisa karna hai, online ya cash?",
  "Nearest outlet kahan hai?",
  "Kya vegetarian options bhi hain?",
  "Allergens info chahiye, nuts se allergy hai",
];

const FOLLOW_UP_MESSAGES = [
  "Status update do mera pichla order",
  "Order confirm hua?",
  "Estimated delivery time kya hai?",
  "Track kar saktay hain order?",
  "Order cancel karna chahta hun",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function generatePhone(i: number): string {
  // Simulate Pakistani mobile numbers (9232xxxxxxx)
  const base = 923210000000 + i;
  return base.toString();
}

interface TestCustomer {
  index: number;
  phone: string;
  scenario: "order" | "complaint" | "inquiry" | "followup" | "mixedorder";
  message: string;
}

interface TestResult {
  phone: string;
  scenario: string;
  message: string;
  status: "queued" | "failed" | "error";
  latencyMs: number;
  httpStatus?: number;
  error?: string;
}

interface SystemSnapshot {
  orders: any[];
  customers: any[];
  complaintCustomers: any[];
  errors: string[];
}

// ─── Build Test Customers ─────────────────────────────────────────────────────

function buildTestCustomers(): TestCustomer[] {
  const customers: TestCustomer[] = [];
  for (let i = 0; i < TOTAL_CUSTOMERS; i++) {
    const phone = generatePhone(i);

    let scenario: TestCustomer["scenario"];
    let message: string;

    // Distribution:
    // 40% = food orders
    // 15% = complaints 
    // 25% = menu/inquiry
    // 10% = mixed order (multiple items)
    // 10% = follow-up / general

    const rand = Math.random();
    if (rand < 0.40) {
      scenario = "order";
      message = randomFrom(FOOD_ORDERS);
    } else if (rand < 0.55) {
      scenario = "complaint";
      message = randomFrom(COMPLAINT_MESSAGES);
    } else if (rand < 0.80) {
      scenario = "inquiry";
      message = randomFrom(GENERAL_INQUIRIES);
    } else if (rand < 0.90) {
      scenario = "mixedorder";
      const items = [randomFrom(FOOD_ORDERS), randomFrom(FOOD_ORDERS)].join(", aur ");
      message = items;
    } else {
      scenario = "followup";
      message = randomFrom(FOLLOW_UP_MESSAGES);
    }

    customers.push({ index: i, phone, scenario, message });
  }
  return customers;
}

// ─── Fire Single Request ──────────────────────────────────────────────────────

async function sendSimulatedMessage(customer: TestCustomer): Promise<TestResult> {
  const start = Date.now();
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (COOKIE) {
      headers["Cookie"] = `hazel_client_session=${COOKIE}`;
    }

    const resp = await fetch(`${BASE_URL}/api/whatsapp/simulate-bulk`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone: customer.phone,
        message: customer.message,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const latencyMs = Date.now() - start;
    let body: any = {};
    try {
      body = await resp.json();
    } catch {}

    if (!resp.ok || body.success === false) {
      return {
        phone: customer.phone,
        scenario: customer.scenario,
        message: customer.message,
        status: "failed",
        latencyMs,
        httpStatus: resp.status,
        error: body.error || `HTTP ${resp.status}`,
      };
    }

    return {
      phone: customer.phone,
      scenario: customer.scenario,
      message: customer.message,
      status: "queued",
      latencyMs,
      httpStatus: resp.status,
    };
  } catch (err: any) {
    return {
      phone: customer.phone,
      scenario: customer.scenario,
      message: customer.message,
      status: "error",
      latencyMs: Date.now() - start,
      error: err.message,
    };
  }
}

// ─── Fetch System State ───────────────────────────────────────────────────────

async function getSystemSnapshot(): Promise<SystemSnapshot> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (COOKIE) {
    headers["Cookie"] = `hazel_client_session=${COOKIE}`;
  }

  const errors: string[] = [];

  // Fetch orders
  let orders: any[] = [];
  try {
    const resp = await fetch(`${BASE_URL}/api/whatsapp/orders`, { headers });
    const data = await resp.json();
    orders = Array.isArray(data) ? data : [];
  } catch (e: any) {
    errors.push(`Orders fetch failed: ${e.message}`);
  }

  // Fetch chats + customers
  let customers: any[] = [];
  let complaintCustomers: any[] = [];
  try {
    const resp = await fetch(`${BASE_URL}/api/whatsapp/chats`, { headers });
    const data = await resp.json();
    if (data.customers) {
      customers = data.customers;
      complaintCustomers = customers.filter((c: any) => {
        try {
          const prefs = JSON.parse(c.preferences || "{}");
          return prefs.hasComplaint === true;
        } catch {
          return false;
        }
      });
    }
  } catch (e: any) {
    errors.push(`Chats fetch failed: ${e.message}`);
  }

  return { orders, customers, complaintCustomers, errors };
}

// ─── Compute Percentiles ──────────────────────────────────────────────────────

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║         HazelWhat 200-Customer Load Test Runner          ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`\n🎯 Target: ${BASE_URL}`);
  console.log(`📦 Customers: ${TOTAL_CUSTOMERS}`);
  console.log(`⚡ Concurrency Batch: ${CONCURRENCY_BATCH}`);
  console.log(`⏳ Processing Wait: ${RESULTS_WAIT_MS / 1000}s\n`);

  // ─── Pre-test Snapshot ──────────────────────────────────────────────────────
  console.log("📸 Capturing pre-test system snapshot...");
  const pre = await getSystemSnapshot();
  console.log(`   Pre-test: ${pre.orders.length} existing orders, ${pre.customers.length} existing customers`);

  // ─── Build Test Plan ────────────────────────────────────────────────────────
  const customers = buildTestCustomers();
  const scenarioCounts = customers.reduce((acc, c) => {
    acc[c.scenario] = (acc[c.scenario] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log("\n📋 Test Plan Distribution:");
  console.log(`   🍔 Orders:       ${scenarioCounts.order || 0}`);
  console.log(`   🚨 Complaints:   ${scenarioCounts.complaint || 0}`);
  console.log(`   ❓ Inquiries:    ${scenarioCounts.inquiry || 0}`);
  console.log(`   🛒 Mixed Orders: ${scenarioCounts.mixedorder || 0}`);
  console.log(`   🔄 Follow-ups:   ${scenarioCounts.followup || 0}`);

  // ─── Fire All Requests in Batches ──────────────────────────────────────────
  const results: TestResult[] = [];
  const testStart = Date.now();
  let processed = 0;

  console.log(`\n🚀 Firing ${TOTAL_CUSTOMERS} messages in batches of ${CONCURRENCY_BATCH}...\n`);

  for (let batch = 0; batch < TOTAL_CUSTOMERS; batch += CONCURRENCY_BATCH) {
    const batchCustomers = customers.slice(batch, batch + CONCURRENCY_BATCH);
    const batchNum = Math.floor(batch / CONCURRENCY_BATCH) + 1;
    const totalBatches = Math.ceil(TOTAL_CUSTOMERS / CONCURRENCY_BATCH);

    process.stdout.write(`  Batch ${batchNum}/${totalBatches} [${batchCustomers.length} msgs]... `);
    const batchStart = Date.now();

    const batchResults = await Promise.all(batchCustomers.map(c => sendSimulatedMessage(c)));
    results.push(...batchResults);

    const batchMs = Date.now() - batchStart;
    const batchOk = batchResults.filter(r => r.status === "queued").length;
    const batchFail = batchResults.filter(r => r.status !== "queued").length;

    console.log(`✓ ${batchOk} queued, ✗ ${batchFail} failed [${batchMs}ms]`);
    processed += batchCustomers.length;

    // Small pause between batches to avoid overwhelming the ingress rate limiter
    if (batch + CONCURRENCY_BATCH < TOTAL_CUSTOMERS) {
      await sleep(500);
    }
  }

  const injectionMs = Date.now() - testStart;
  console.log(`\n✅ Message injection complete in ${(injectionMs / 1000).toFixed(1)}s`);

  // ─── Injection Results Summary ──────────────────────────────────────────────
  const queued = results.filter(r => r.status === "queued");
  const failed = results.filter(r => r.status === "failed");
  const errored = results.filter(r => r.status === "error");
  const latencies = queued.map(r => r.latencyMs);

  console.log("\n────────────────────────────────────────────────────────────");
  console.log("📊 INJECTION RESULTS");
  console.log("────────────────────────────────────────────────────────────");
  console.log(`  Total Sent:      ${results.length}`);
  console.log(`  ✅ Queued:       ${queued.length} (${((queued.length / results.length) * 100).toFixed(1)}%)`);
  console.log(`  ❌ Failed:       ${failed.length} (${((failed.length / results.length) * 100).toFixed(1)}%)`);
  console.log(`  💥 Network Err:  ${errored.length}`);

  if (latencies.length > 0) {
    console.log(`\n  Injection Latency (API response, not AI processing):`);
    console.log(`    p50:  ${percentile(latencies, 50)}ms`);
    console.log(`    p90:  ${percentile(latencies, 90)}ms`);
    console.log(`    p99:  ${percentile(latencies, 99)}ms`);
    console.log(`    max:  ${Math.max(...latencies)}ms`);
    console.log(`    min:  ${Math.min(...latencies)}ms`);
  }

  if (failed.length > 0) {
    console.log(`\n  ❌ Failed Message Details (first 10):`);
    failed.slice(0, 10).forEach(r => {
      console.log(`    ${r.phone} [${r.scenario}] HTTP:${r.httpStatus} — ${r.error}`);
    });
  }

  if (errored.length > 0) {
    console.log(`\n  💥 Network Error Details (first 5):`);
    errored.slice(0, 5).forEach(r => {
      console.log(`    ${r.phone} — ${r.error}`);
    });
  }

  // ─── Wait for AI Processing ─────────────────────────────────────────────────
  if (queued.length > 0) {
    console.log(`\n⏳ Waiting ${RESULTS_WAIT_MS / 1000}s for AI to process all queued messages...`);
    
    // Progress monitor
    let elapsed = 0;
    const interval = 5000;
    while (elapsed < RESULTS_WAIT_MS) {
      await sleep(interval);
      elapsed += interval;
      const remaining = ((RESULTS_WAIT_MS - elapsed) / 1000).toFixed(0);
      process.stdout.write(`  ⏱ ${elapsed / 1000}s elapsed... (${remaining}s remaining)\r`);
    }
    console.log();
  }

  // ─── Post-test Snapshot ──────────────────────────────────────────────────────
  console.log("\n📸 Capturing post-test system snapshot...");
  const post = await getSystemSnapshot();

  const newOrders = post.orders.filter(o => !pre.orders.some((po: any) => po.id === o.id));
  const newCustomers = post.customers.filter(c => !pre.customers.some((pc: any) => pc.phone === c.phone));
  const complaintCustomers = post.complaintCustomers;

  // ─── Full Report ──────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                 FULL TEST REPORT                        ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("─── 1. MESSAGE INJECTION ────────────────────────────────────");
  console.log(`  Total customers simulated:  ${TOTAL_CUSTOMERS}`);
  console.log(`  Messages queued to AI:       ${queued.length}/${TOTAL_CUSTOMERS}`);
  console.log(`  Messages dropped/failed:     ${failed.length + errored.length}`);
  console.log(`  Injection duration:          ${(injectionMs / 1000).toFixed(1)}s`);
  console.log(`  Throughput:                  ${(TOTAL_CUSTOMERS / (injectionMs / 1000)).toFixed(1)} msg/s`);

  console.log("\n─── 2. ORDERS ───────────────────────────────────────────────");
  const expectedOrders = customers.filter(c => c.scenario === "order" || c.scenario === "mixedorder").length;
  const captureRate = newOrders.length > 0 ? ((newOrders.length / expectedOrders) * 100).toFixed(1) : "0";
  console.log(`  Expected order attempts:     ~${expectedOrders}`);
  console.log(`  Orders actually created:     ${newOrders.length}`);
  console.log(`  Order capture rate:          ${captureRate}%`);
  if (newOrders.length > 0) {
    console.log(`\n  Recent new orders (first 10):`);
    newOrders.slice(0, 10).forEach((o: any) => {
      console.log(`    📦 ${o.phone || "unknown"} — "${o.productName || "N/A"}" — ${o.price || "?"}`);
    });
  } else {
    console.log(`\n  ⚠️  NO NEW ORDERS CREATED — AI may have not processed in time, or orders need full conversation context`);
  }

  console.log("\n─── 3. COMPLAINTS ───────────────────────────────────────────");
  const expectedComplaints = customers.filter(c => c.scenario === "complaint").length;
  const complaintCaptureRate = complaintCustomers.length > 0 ? ((complaintCustomers.length / expectedComplaints) * 100).toFixed(1) : "0";
  console.log(`  Complaint messages sent:     ${expectedComplaints}`);
  console.log(`  Complaints flagged in CRM:   ${complaintCustomers.length}`);
  console.log(`  Complaint detection rate:    ${complaintCaptureRate}%`);
  if (complaintCustomers.length > 0) {
    console.log(`\n  Detected complaint customers (first 10):`);
    complaintCustomers.slice(0, 10).forEach((c: any) => {
      let summary = "";
      try { summary = JSON.parse(c.preferences || "{}").complaintSummary || ""; } catch {}
      console.log(`    🚨 ${c.phone} — "${summary.substring(0, 80)}"`);
    });
  }

  console.log("\n─── 4. CUSTOMER PROFILES ────────────────────────────────────");
  console.log(`  Pre-test customers:          ${pre.customers.length}`);
  console.log(`  Post-test customers:         ${post.customers.length}`);
  console.log(`  New customers created:       ${newCustomers.length}`);

  console.log("\n─── 5. PERFORMANCE ANALYSIS ─────────────────────────────────");
  if (latencies.length > 0) {
    console.log(`  API injection p50:           ${percentile(latencies, 50)}ms`);
    console.log(`  API injection p90:           ${percentile(latencies, 90)}ms`);
    console.log(`  API injection p99:           ${percentile(latencies, 99)}ms`);
  }
  console.log(`  Total test duration:         ${((Date.now() - testStart) / 1000).toFixed(0)}s`);

  // ─── GAP ANALYSIS ─────────────────────────────────────────────────────────────
  console.log("\n─── 6. GAP ANALYSIS — WHERE WE LACK ───────────────────────");
  
  const gaps: { level: "🔴 CRITICAL" | "🟡 WARNING" | "🟢 GOOD"; issue: string; detail: string }[] = [];

  // Injection failures
  if (failed.length + errored.length > TOTAL_CUSTOMERS * 0.05) {
    gaps.push({
      level: "🔴 CRITICAL",
      issue: "High Message Drop Rate",
      detail: `${failed.length + errored.length}/${TOTAL_CUSTOMERS} messages failed to queue (${(((failed.length + errored.length) / TOTAL_CUSTOMERS) * 100).toFixed(1)}%). Check rate limiter config and server health.`,
    });
  } else if (failed.length + errored.length > 0) {
    gaps.push({
      level: "🟡 WARNING",
      issue: "Some Message Drops",
      detail: `${failed.length + errored.length} messages failed. Mostly acceptable — may be rate limiter rejections at peak.`,
    });
  } else {
    gaps.push({
      level: "🟢 GOOD",
      issue: "Message Delivery",
      detail: "All 200 messages queued successfully.",
    });
  }

  // Order capture rate
  const orderCaptureNum = newOrders.length > 0 ? (newOrders.length / expectedOrders) : 0;
  if (orderCaptureNum < 0.1) {
    gaps.push({
      level: "🔴 CRITICAL",
      issue: "Very Low Order Capture Rate",
      detail: `Only ${newOrders.length}/${expectedOrders} orders captured. AI likely needs multi-turn conversation context (address confirmation) before placing orders. Single messages won't produce orders without prior chat history.`,
    });
  } else if (orderCaptureNum < 0.5) {
    gaps.push({
      level: "🟡 WARNING",
      issue: "Moderate Order Capture",
      detail: `${newOrders.length}/${expectedOrders} orders placed. Address collection flow may be blocking instant order completion.`,
    });
  } else {
    gaps.push({
      level: "🟢 GOOD",
      issue: "Order Capture Rate",
      detail: `${newOrders.length}/${expectedOrders} orders placed (${captureRate}%).`,
    });
  }

  // Complaint detection
  const complaintCaptureNum = complaintCustomers.length > 0 ? (complaintCustomers.length / expectedComplaints) : 0;
  if (complaintCaptureNum < 0.5) {
    gaps.push({
      level: "🟡 WARNING",
      issue: "Low Complaint Detection Rate",
      detail: `Only ${complaintCustomers.length}/${expectedComplaints} complaints detected. Heuristic keywords may not be catching all Roman Urdu complaint patterns, or AI processing hasn't completed.`,
    });
  } else {
    gaps.push({
      level: "🟢 GOOD",
      issue: "Complaint Detection",
      detail: `${complaintCustomers.length}/${expectedComplaints} complaints flagged (${complaintCaptureRate}%).`,
    });
  }

  // API latency
  const p99 = percentile(latencies, 99);
  if (p99 > 5000) {
    gaps.push({
      level: "🔴 CRITICAL",
      issue: "High Injection Latency",
      detail: `p99 injection latency = ${p99}ms. Server is under load. Queue may be backing up.`,
    });
  } else if (p99 > 2000) {
    gaps.push({
      level: "🟡 WARNING",
      issue: "Elevated Injection Latency",
      detail: `p99 injection latency = ${p99}ms. Acceptable but approaching limits under 200 concurrent load.`,
    });
  } else {
    gaps.push({
      level: "🟢 GOOD",
      issue: "API Injection Latency",
      detail: `p99 = ${p99}ms — fast injection under concurrent load.`,
    });
  }

  // Customer profile creation
  const profileCoverageRate = newCustomers.length / queued.length;
  if (profileCoverageRate < 0.5) {
    gaps.push({
      level: "🟡 WARNING",
      issue: "Low Customer Profile Creation",
      detail: `Only ${newCustomers.length} new customer profiles created vs ${queued.length} queued. CRM auto-creation may be lagging behind AI processing.`,
    });
  } else {
    gaps.push({
      level: "🟢 GOOD",
      issue: "Customer Profile Creation",
      detail: `${newCustomers.length} new profiles created.`,
    });
  }

  // Print gaps
  gaps.forEach(g => {
    console.log(`\n  ${g.level}: ${g.issue}`);
    console.log(`    → ${g.detail}`);
  });

  // ─── Additional Diagnostic Output ────────────────────────────────────────────
  if (post.errors.length > 0) {
    console.log("\n─── 7. API ERRORS ───────────────────────────────────────────");
    post.errors.forEach(e => console.log(`  ⚠️  ${e}`));
  }

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  const totalGaps = gaps.filter(g => g.level !== "🟢 GOOD");
  const criticals = gaps.filter(g => g.level === "🔴 CRITICAL");
  const warnings = gaps.filter(g => g.level === "🟡 WARNING");
  const goods = gaps.filter(g => g.level === "🟢 GOOD");
  console.log(`║  SUMMARY: ${criticals.length} Critical | ${warnings.length} Warning | ${goods.length} Passing         ║`);
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  process.exit(criticals.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("\n💥 FATAL ERROR:", err);
  process.exit(1);
});
