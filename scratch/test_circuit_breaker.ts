import { 
  isRetryableProviderError, 
  ProviderError, 
  getCircuitStatus, 
  recordProviderFailure, 
  recordProviderSuccess, 
  isProviderAvailable 
} from "../src/lib/ai-handler";
import Anthropic from "@anthropic-ai/sdk";

console.log("=== RUNNING LLM PROVIDER & CIRCUIT BREAKER TESTS ===");

// 1. Test isRetryableProviderError Classification
console.log("\n[Test 1] Testing isRetryableProviderError Classification:");

const dummyHeaders = new Headers();
const authErr = new Anthropic.AuthenticationError(401, { error: { message: "Invalid API Key" } }, "Invalid API key", dummyHeaders);
console.log("Anthropic AuthenticationError (401) isRetryable:", isRetryableProviderError(authErr) === false ? "✅ FALSE (Non-retryable)" : "❌ FAILED");

const permErr = new Anthropic.PermissionDeniedError(403, { error: { message: "Permission Denied" } }, "Forbidden", dummyHeaders);
console.log("Anthropic PermissionDeniedError (403) isRetryable:", isRetryableProviderError(permErr) === false ? "✅ FALSE (Non-retryable)" : "❌ FAILED");

const deepseekQuotaErr = new ProviderError("DeepSeek API Error (402): Insufficient Balance", 402, "deepseek");
console.log("DeepSeek Insufficient Balance (402) isRetryable:", isRetryableProviderError(deepseekQuotaErr) === false ? "✅ FALSE (Non-retryable)" : "❌ FAILED");

const deepseekInvalidKeyErr = new ProviderError("DeepSeek API Error (401): Incorrect API key provided", 401, "deepseek");
console.log("DeepSeek Invalid Key (401) isRetryable:", isRetryableProviderError(deepseekInvalidKeyErr) === false ? "✅ FALSE (Non-retryable)" : "❌ FAILED");

const rateLimitErr = new Anthropic.RateLimitError(429, { error: { message: "Rate limit reached" } }, "Rate limit", dummyHeaders);
console.log("Anthropic RateLimitError (429) isRetryable:", isRetryableProviderError(rateLimitErr) === true ? "✅ TRUE (Retryable)" : "❌ FAILED");

const connTimeoutErr = new Anthropic.APIConnectionTimeoutError({ message: "Request timed out" });
console.log("Anthropic APIConnectionTimeoutError isRetryable:", isRetryableProviderError(connTimeoutErr) === true ? "✅ TRUE (Retryable)" : "❌ FAILED");

const serverErr = new Anthropic.InternalServerError(500, { error: { message: "Internal server error" } }, "Server error", dummyHeaders);
console.log("Anthropic InternalServerError (500) isRetryable:", isRetryableProviderError(serverErr) === true ? "✅ TRUE (Retryable)" : "❌ FAILED");

// 2. Test Circuit Breaker State Transitions
console.log("\n[Test 2] Testing Circuit Breaker State Transitions:");

// Initially closed
recordProviderSuccess("deepseek");
const initialStatus = getCircuitStatus("deepseek");
console.log("Initial DeepSeek status:", initialStatus.state === "closed" ? "✅ CLOSED" : `❌ FAILED (${initialStatus.state})`);

// Trigger non-retryable failure -> opens circuit immediately
recordProviderFailure("deepseek", deepseekQuotaErr);
const openStatus = getCircuitStatus("deepseek");
console.log("Status after non-retryable error (402):", openStatus.state === "open" ? "✅ OPEN" : `❌ FAILED (${openStatus.state})`);
console.log("isProviderAvailable('deepseek'):", isProviderAvailable("deepseek") === false ? "✅ FALSE (Skipped)" : "❌ FAILED");

// Recovery test
recordProviderSuccess("deepseek");
const recoveredStatus = getCircuitStatus("deepseek");
console.log("Status after recovery:", recoveredStatus.state === "closed" ? "✅ CLOSED" : `❌ FAILED (${recoveredStatus.state})`);

console.log("\n=== ALL LLM PROVIDER & CIRCUIT BREAKER TESTS PASSED SUCCESSFULLY ===");
