# PHASE 6C — DETERMINISTIC JOB DEDUPLICATION, TRACE CONTEXT & WORKER AUDIT REPORT

> **Document Type**: Phase 6C Architectural & Security Audit  
> **Status**: Completed  
> **Verdict**: **GO** (Ready for Phase 6D Scheduling & Queue Topology Enhancements)  
> **Timestamp**: 2026-08-23T16:53:30Z  

---

## 1. Executive Summary & Verdict

Phase 6C transitions the HazelWhat message ingestion and worker processing pipeline into an **idempotent, trace-aware, tenant-fair distributed worker architecture**. 

By introducing deterministic BullMQ job IDs (`msg_${tenantId}_${messageId}`), end-to-end `AsyncLocalStorage` trace context propagation across queue boundaries, bounded tenant-fair concurrency caps (`MAX_TENANT_CONCURRENCY = 5`), and verified LLM billing idempotency (`ON CONFLICT (tenant_id, request_id, llm_call_index)`), the system eliminates double-processing of duplicate webhooks and protects financial ledger integrity during worker retries.

### Verdict: **GO**
*   **Build Integrity**: `npm run build` succeeded cleanly (**Exit Code: 0**).
*   **Test Suite**: 14 / 14 test cases in `scratch/test_phase6c_job_worker.ts` **PASSED** with zero failures.
*   **Backward Compatibility**: Phase 6B Redis distributed locking and session registry semantics preserved without regressions.

---

## 2. Current vs. Redesigned Architecture

```
[ Incoming Webhook / WhatsApp Event ]
                 │
                 ▼
 [ Ingestion API: handleWhatsAppMessage ]
  ├── 1. System Backpressure Check (< 1,000 Jobs)
  ├── 2. Tenant Ingress Rate Limiter (Token Bucket)
  └── 3. Deterministic Job ID Generator: msg_${tenantId}_${messageId}
                 │
                 ▼
 [ Enqueue Payload + Trace Context ]
  ├── Payload: { msg, tenantId, customerId, conversationId, traceContext }
  └── Trace Context: { requestId, traceId, correlationId, tenantId, customerId }
                 │
  ┌──────────────┴──────────────┐
  ▼                             ▼
[ BullMQ Redis Queue ]   [ Bounded In-Memory Queue (Redis Offline) ]
(opts.jobId Deduplication)   (Capacity Cap: 1,000, Dedupe Set: 5,000)
  │                             │
  └──────────────┬──────────────┘
                 ▼
     [ Queue Worker Pool ]
  ├── Concurrency Limit: 20
  ├── Max Tenant Concurrency: 5 (Tenant Fairness Cap)
  ├── Reconstruct AsyncLocalStorage Context via runWithTraceContext(...)
  └── Customer Lock Guard: DistributedLock.acquire(tenantId, customerId)
                 │
                 ▼
 [ AI Handler & LLM Execution ]
  └── logLLMUsage Idempotency: ON CONFLICT(tenant_id, request_id, llm_call_index)
```

---

## 3. Exact Changes Made

| File / Component | Type | Summary of Changes |
| :--- | :--- | :--- |
| `src/lib/queue-manager.ts` | **Refactor** | Implemented deterministic `jobId` generation (`msg_${tenantId}_${messageId}`), `WhatsAppJobPayload` context propagation, worker-side `AsyncLocalStorage` reconstruction via `runWithTraceContext`, per-tenant concurrency tracking (`MAX_TENANT_CONCURRENCY = 5`), and bounded in-memory fallback (`MAX_MEMORY_QUEUE_SIZE = 1000`). |
| `src/lib/ai-handler.ts` | **Modification** | Updated `handleWhatsAppMessage` to pass `customerId` and trace context down to `enqueueWhatsAppMessageJob`. Refactored `processWhatsAppWorkerJob` to consume `WhatsAppJobPayload` and enforce customer-level locks. |
| `.env.example` | **Config** | Preserved Redis connection variables and instance identifiers. |
| `scratch/test_phase6c_job_worker.ts` | **New Suite** | Created comprehensive 14-test verification suite covering deduplication, multi-tenant isolation, trace propagation, LLM billing idempotency, and tenant fairness. |
| `phase6c_job_worker_audit.md` | **Deliverable** | Full architectural audit report and GO / NO-GO assessment. |

---

## 4. Deterministic Job-ID Algorithm

*   **Formula**: `jobId = msg_${sanitize(tenantId)}_${sanitize(rawMessageId)}`
*   **Key Source**: WhatsApp Meta / Baileys `msg.key.id` (e.g. `wamid.HBgL...`).
*   **Tenant Namespacing**: Prepend `tenantId` to ensure two tenants receiving identical message IDs (e.g., test or numeric IDs) do NOT collide or deduplicate each other.
*   **BullMQ Behavior**: When a duplicate webhook arrives, `queue.add("process_whatsapp_message", payload, { jobId })` detects that `jobId` already exists in Redis and returns the existing job without enqueuing a duplicate execution.
*   **Fallback**: If `msg.key.id` is absent, falls back to `fallback_${Date.now()}`.

---

## 5. Trace Context Propagation Design

1.  **Ingestion Phase**: `handleWhatsAppMessage` retrieves or initializes `TraceContextData` containing `requestId`, `traceId`, `correlationId`, `tenantId`, `customerId`, and `conversationId`.
2.  **Queue Serialization**: `traceContext` object is serialized into the BullMQ job payload.
3.  **Worker Reconstruction**: Before executing the message handler, `registerQueueWorker` wraps execution inside `runWithTraceContext(job.data.traceContext, async () => { ... })`.
4.  **Preservation on Retry**: On BullMQ job failures, BullMQ retries attempt 2 and attempt 3 using the **same original job payload**. The `requestId` and `traceId` remain identical across retries.
5.  **Logging**: Worker job logs, failure logs, and LLM billing entries inherit `requestId` and `traceId` directly from `AsyncLocalStorage`.

---

## 6. LLM Billing Idempotency & Retry Behavior

*   **Database Guard**: Database table `llm_usage_logs` enforces `UNIQUE(tenant_id, request_id, llm_call_index)`.
*   **Billing Logging (`logLLMUsage`)**: Employs `ON CONFLICT (tenant_id, request_id, llm_call_index) DO NOTHING` in Supabase and a `Set<string>` in-memory guard (`${tenantId}:${requestId}:${llmCallIndex}`).
*   **Tool Loop Support**: Sequential LLM calls within a single message turn pass `llmCallIndex = 0` (initial prompt) and `llmCallIndex = 1` (tool result turn), preventing intra-request collisions.
*   **Retry Safety**: If a worker job fails after an LLM call was logged and BullMQ retries the job, the retry uses the **same `requestId`**. The duplicate `logLLMUsage` invocation resolves as a no-op, preserving exactly 1 billing ledger entry.

---

## 7. Tenant Fairness & Queue Architecture

*   **Concurrency Architecture**: Total worker pool concurrency is set to `20`.
*   **Tenant Concurrency Cap**: `MAX_TENANT_CONCURRENCY = 5`.
*   **Starvation Protection**: Tracks active worker job count per tenant (`tenantActiveWorkers.get(tenantId)`). If a single tenant floods the queue with 1,000 messages, it cannot occupy more than 5 concurrent worker slots, leaving at least 15 slots open for other tenants.
*   **Same-Customer Ordering**: Preserved via per-customer distributed locks (`DistributedLock.acquire(tenantId, customerId)`). Messages from customer X are processed sequentially even if queued concurrently.

---

## 8. Redis Failure Semantics

*   **Fail-Closed Ownership**: Preserves Phase 6B semantics — if Redis is offline, distributed WhatsApp session leases fail closed (`reason: "redis_unavailable"`), preventing socket collisions across multi-node workers.
*   **Bounded Memory Queue**: If Redis is offline, `enqueueWhatsAppMessageJob` falls back to `memoryQueue` with a hard limit of `MAX_MEMORY_QUEUE_SIZE = 1000`. Overflows trigger a `QueueBackpressureExceeded` error and alert log rather than growing memory unboundedly.
*   **In-Memory Deduplication**: Maintains an in-memory `Set` of up to 5,000 processed job IDs to prevent duplicate execution during offline fallback.

---

## 9. Security & Data Protection Analysis

*   **Tenant Authentication**: Tenant identity is determined exclusively via server-validated phone mapping (`WhatsAppManager.resolveTenantForPhone(from)`) or authenticated session context — never trusted from unauthenticated client input.
*   **Credential Protection**: Secret tokens, API keys (`OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`), and database connection strings are excluded from job payloads and Pino log outputs.
*   **PII Hygiene**: Error signatures are normalized (`normalizeErrorSignature`) to replace phone numbers, email addresses, UUIDs, and hex values with generic tokens (`<PHONE>`, `<EMAIL>`, `<UUID>`) before storing error fingerprints.

---

## 10. Test Results & Build Verification

### Test Suite Execution (`scratch/test_phase6c_job_worker.ts`)

```
=======================================================
PHASE 6C — JOB DEDUPLICATION, TRACE CONTEXT & WORKER SUITE
=======================================================

  ✓ PASSED: TEST 1: Same WhatsApp message submitted 100 times -> exactly 1 job
  ✓ PASSED: TEST 2: Same message ID across two tenants -> 2 independent jobs
  ✓ PASSED: TEST 3: Two genuinely different messages -> 2 jobs
  ✓ PASSED: TEST 4: BullMQ retry preserves requestId across execution attempts
  ✓ PASSED: TEST 5: BullMQ retry preserves traceId across execution attempts
  ✓ PASSED: TEST 6: Worker reconstructs AsyncLocalStorage context correctly
  ✓ PASSED: TEST 7: 100 concurrent jobs across multiple tenants -> zero context leakage
  ✓ PASSED: TEST 8: Same LLM invocation retried 10 times -> exactly 1 billing ledger row
  ✓ PASSED: TEST 9: Tool-loop calls produce deterministic call indexes 0, 1 without collision
  ✓ PASSED: TEST 10: Redis unavailable enters safe bounded memory fallback mode
  ✓ PASSED: TEST 11: Job failure/retry logs contain correct tenant and trace metadata
  ✓ PASSED: TEST 12: No sensitive credentials appear in serialized job payloads or return metadata
  ✓ PASSED: TEST 13: Same-customer ordering remains intact via deterministic customer job queueing
  ✓ PASSED: TEST 14: One noisy tenant cannot completely starve other tenants under tenant-fairness scheduler

=======================================================
TEST SUMMARY: 14 PASSED, 0 FAILED
=======================================================
```

### Production Build Result (`npm run build`)

```
▲ Next.js 16.2.11 (Turbopack)
✓ Compiled successfully in 38.3s
✓ Generating static pages using 3 workers (22/22)
Exit code: 0
```

---

## 11. Remaining Limitations & Production Blockers

### Remaining Limitations
1.  **Queue Topology**: Currently uses a single shared BullMQ queue name (`whatsapp-message-queue`) with worker-side tenant concurrency limits. Multi-queue BullMQ topologies per priority class (e.g., VIP vs standard tenant queues) are deferred to Phase 6D.
2.  **Cross-Node In-Memory Deduplication**: When Redis is completely offline, job deduplication relies on node-local in-memory LRU sets. Cross-node deduplication during a complete Redis outage requires Redis recovery.

### Production Blockers
*   **None for Phase 6C.** All Phase 6C requirements are fully implemented, verified, and passing.

---

## 12. Explicit Verdict

### Verdict: **GO**

Phase 6C implementation is certified complete and production-grade. The system is ready for user review and Phase 6D authorization.
