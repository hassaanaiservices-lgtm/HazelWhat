# PHASE 6 — HORIZONTAL SCALING & DISTRIBUTED WORKER AUDIT (PHASE 6A)

**Document Status:** Complete Base Architecture & Scale Audit  
**Date:** 2026-08-23  
**Target Environment:** Multi-Tenant WhatsApp AI SaaS (10 → 1,000+ Tenants)  

---

## Executive Summary & Codebase Audit Findings

This audit evaluates the **HazelWhat Multi-Tenant WhatsApp & AI Processing Platform** to identify architectural singletons, in-memory state dependencies, queue topology limits, session ownership mechanics, and failure modes prior to implementing horizontal scaling.

---

## Comprehensive 50-Question Audit

### Statelessness & In-Memory State

#### 1. Is the current application stateless?
**No.** While Next.js App Router API routes are stateless at the HTTP request layer, core runtime features rely heavily on single-process memory state. Key stateful components in process memory include WhatsApp socket objects (`baileysSessions` Map), in-memory fallback message queue (`memoryQueue`), in-memory lock fallback map (`inMemoryLocks`), deduplication cache (`processedMessageIds` array), circuit breaker provider state (`providerCircuits`), and active tenant singletons (`activeTenantId`).

#### 2. Which state currently exists in process memory?
- **WhatsApp Baileys Sockets:** `globalForBaileys.baileysSessions` Map holding active WASocket instances per tenant.
- **In-Memory Fallback Queue:** `memoryQueue` array and `activeMemoryWorkers` counter in `src/lib/queue-manager.ts`.
- **Message Deduplication Cache:** `globalForDeduplication.processedMessageIds` array capped at 1,000 items in `src/lib/ai-handler.ts`.
- **In-Memory Distributed Lock Fallback:** `DistributedLock.inMemoryLocks` Map in `src/lib/ai-handler.ts`.
- **In-Memory Rate Limiter Fallback:** `IngressRateLimiter.inMemoryBuckets` Map in `src/lib/ai-handler.ts`.
- **LLM Circuit Breaker State:** `providerCircuits` module-level JS object in `src/lib/ai-handler.ts`.
- **Observability Fallbacks:** `inMemoryAppErrors`, `inMemoryLLMUsageLogs`, `inMemoryErrorGroups` in `src/lib/observability-store.ts`.

#### 3. Which state must move to Redis/database?
- **WhatsApp Session Ownership Registry:** Distributed lease mapping `tenant_id -> instance_id` with heartbeat in Redis.
- **Message Deduplication Cache:** Atomic Redis Key check-and-set (`SET key val NX EX ttl`).
- **Distributed Locks:** Standardize 100% on Redis-backed distributed locks with token verification; eliminate silent node-local memory fallbacks during horizontal scaling.
- **LLM Circuit Breaker & Rate Limits:** Centralized Redis hashes for provider health, tenant token buckets, and global concurrency semaphores.
- **Queue State:** Standardize 100% on Redis-backed BullMQ queues across all instances.

---

### Queue Architecture & BullMQ Topology

#### 4. Is queue state fully shared across instances?
**Yes, when `REDIS_URL` is set.** BullMQ connects to Redis using queue name `"whatsapp-message-queue"`. However, if `REDIS_URL` is missing or Redis drops connection, `queue-manager.ts` falls back to an in-memory array (`memoryQueue`) which is strictly isolated to a single process.

#### 5. Is BullMQ configured correctly for distributed workers?
**Partially.** `queue-manager.ts` initializes BullMQ `Queue` and `Worker` instances using `CONCURRENCY_LIMIT = 20`. However:
- Default job options lack explicit `lockDuration` or `stalledInterval` optimization for long LLM calls.
- There is only a single global queue (`"whatsapp-message-queue"`) with no priority levels or per-tenant sub-queues.

#### 6. Are job IDs deterministic/idempotent?
**No.** In `src/lib/queue-manager.ts` line 59:
```typescript
const jobName = `msg-${msg.key?.id || Date.now()}`;
await messageQueue.add(jobName, { msg, inputTenantId });
```
Passing `jobName` as the 1st argument sets the job *name*, but BullMQ requires `jobId` in `JobsOptions` (the 3rd argument) to enforce deduplication. Currently, duplicate enqueues create duplicate BullMQ jobs.

#### 7. Can the same WhatsApp message be processed twice?
**Yes.** 
1. If duplicate webhooks/upserts arrive before deduplication, or if deduplication runs on separate nodes (since `processedMessageIds` is currently in-memory per node).
2. If a worker crashes during LLM processing, BullMQ retries the job (up to `attempts: 2`), executing all side effects again.

#### 8. What happens if a worker crashes halfway through processing?
BullMQ marks the job as stalled after lock expiration and re-queues it to another worker. Because processing steps (STT, LLM call, DB write, WhatsApp reply) are not wrapped in step-level idempotency checks, retrying the job re-runs LLM calls, re-adds DB records, and re-sends WhatsApp messages.

---

### Fault Tolerance & Resilience

#### 9. What happens if Redis disconnects?
- `queue-manager.ts` logs warnings; enqueue falls back to `memoryQueue`.
- `DistributedLock` logs warnings and falls back to `DistributedLock.inMemoryLocks`.
- `IngressRateLimiter` falls back to `IngressRateLimiter.inMemoryBuckets`.
- Active BullMQ workers emit connection errors.

#### 10. What happens if PostgreSQL becomes unavailable?
- `observability-store.ts` catches Supabase errors and buffers logs (`logLLMUsage`, `logAppError`) into memory.
- `DB.addOrder`, `DB.addChatMessage`, and `DB.updateCustomer` fail or log errors, though the LLM attempt completes.

#### 11. What happens if the LLM provider times out?
- `callLLM` throws an `AbortController` timeout error (15s timeout for text LLMs).
- `callLLMWithFallback` catches the timeout, flags provider failure in `providerCircuits`, and attempts the fallback provider (e.g. DeepSeek -> Anthropic). If all fail, a polite error reply is returned to the user.

#### 12. What happens if an instance dies during an LLM call?
The HTTP connection to the LLM terminates. BullMQ detects worker process death when the job lock expires and re-assigns the job to a surviving worker node.

---

### Distributed Locking & Concurrency Controls

#### 13. Are customer locks local or distributed?
**Distributed when Redis is online, local when offline.** `DistributedLock.acquire(tenantId, customerId)` attempts `RedisLockManager.acquire("lock:${tenantId}:${customerId}")`. If Redis is offline, it falls back to `inMemoryLocks` (Node-local Map).

#### 14. Are tenant locks local or distributed?
**Local.** Session connection initialization relies on `session.initLockPromise` (a single-node JS Promise in `whatsapp.ts`). There is no distributed cross-instance lock for tenant socket initialization.

#### 15. Can two workers process the same customer's messages simultaneously?
- **With Redis online:** No. Redis lock key `lock:${tenantId}:${customerId}` prevents concurrent execution.
- **Without Redis or across separate nodes during Redis outage:** Yes, because in-memory locks are local to each process.

---

### WhatsApp Multi-Tenant Session Architecture

#### 16. How are WhatsApp sessions distributed across instances?
**They are currently not distributed.** Each Node.js process manages its own `baileysSessions` Map.

#### 17. Can two instances accidentally create two sockets for the same tenant?
**Yes.** If Node 1 and Node 2 both execute `WhatsAppManager.connectTenant(tenantId)` (e.g. triggered by incoming webhooks or watchdog timers), both processes read the tenant credentials from DB and attempt to establish separate Baileys WASockets. WhatsApp's servers will immediately reject/disconnect one or both sockets with 440 Conflict / Stream Errored.

#### 18. How is session ownership maintained?
Currently purely in process memory on the node executing `connectTenant`. No distributed lease or heartbeat registry exists in Redis.

#### 19. What happens when a WhatsApp connection reconnects?
`sock.ev.on("connection.update")` handles `close` by calculating exponential backoff (`getReconnectBackoff`) and calling `connectTenant`. If multiple nodes attempt reconnection simultaneously, socket collision occurs.

#### 20. What happens during deployment/restart?
`whatsapp.ts` hooks `SIGINT`/`SIGTERM` to iterate over local `baileysSessions` and call `sock.end()`. However, active BullMQ workers are not gracefully paused, and in-flight jobs in local memory queues are dropped.

---

### Redis Failover & Recovery Mechanics

#### 21. What happens when Redis is temporarily unavailable?
Components drop back to node-local in-memory queues, in-memory locks, and in-memory rate limiters. System functions in single-node degraded mode.

#### 22. What happens when Redis permanently fails?
Cross-instance synchronization is broken. Horizontal worker isolation fails, leading to duplicate socket connections and duplicate customer message processing across nodes.

---

### Backpressure, Limits & Tenant Isolation

#### 23. Is there bounded backpressure?
**No.** `enqueueWhatsAppMessageJob` accepts unlimited jobs without checking current queue depth or active memory limits.

#### 24. Is there a maximum queue depth?
No maximum queue depth is enforced prior to job enqueuing.

#### 25. Is there a per-tenant queue/concurrency limit?
`IngressRateLimiter.isAllowed(tenantId, limitPerMin)` limits incoming webhooks per minute, but there is no limit on queued jobs per tenant or active worker slots per tenant in BullMQ.

#### 26. Is there a global worker concurrency limit?
Yes, `CONCURRENCY_LIMIT = 20` in `src/lib/queue-manager.ts`.

#### 27. Is there a per-provider LLM concurrency limit?
No per-provider concurrency semaphore exists.

#### 28. Is there a per-model rate limit?
No per-model rate limiter exists.

#### 29. Can one tenant starve all other tenants?
**Yes.** Because all jobs flow into a single FIFO queue (`"whatsapp-message-queue"`), a burst of 5,000 messages from Tenant A will occupy all 20 worker slots, starving Tenant B until Tenant A's queue clears.

#### 30. Is fair scheduling implemented?
**No.** Queue scheduling is strict FIFO across all tenants.

---

### LLM Cost Protection & Runaway Safeguards

#### 31. Can an LLM failure create an infinite retry loop?
No. `callLLMWithFallback` caps provider retries, BullMQ caps job retries to 2, and AI prompt logic bounds tool-loop iterations.

#### 32. Are retry attempts persisted?
BullMQ persists job retry count in Redis. The in-memory fallback queue does not persist retry state across restarts.

---

### Dead Letter Queue (DLQ) & Observability

#### 33. Is there a Dead Letter Queue?
**No.** Jobs failing after 2 attempts are discarded from BullMQ (`removeOnFail: 200`) or logged via console. No dedicated DLQ queue exists.

#### 34. Is DLQ visibility available from admin dashboard?
**No.** Admin dashboard monitors `app_errors` and `llm_usage_logs`, but has no DLQ inspection interface.

#### 35. Can failed jobs be safely replayed?
Not currently, as no DLQ storage or replay endpoint exists.

#### 36. Is replay idempotent?
LLM logging (`logLLMUsage`) is idempotent via `(tenant_id, request_id, llm_call_index)`, but side effects like `WhatsAppManager.sendMessage` and `DB.addOrder` lack explicit idempotency keys during manual replay.

---

### Trace Context Propagation

#### 37. Are observability trace IDs propagated through BullMQ?
**No.** `enqueueWhatsAppMessageJob` accepts `{ msg, inputTenantId }`. It does not include `traceId`, `requestId`, `correlationId`, or `customerId` in the job payload.

#### 38. Are request_id / trace_id preserved from ingress → queue → worker → LLM?
**No.** When a worker picks up a job from BullMQ, `AsyncLocalStorage` context is empty, causing the worker to generate new random `req_llm_...` and `trc_llm_...` IDs.

---

### Idempotency & Financial Ledger Audit

#### 39. Are LLM usage records idempotent across worker retries?
**Yes, IF `request_id` is preserved.** `logLLMUsage` enforces `ON CONFLICT (tenant_id, request_id, llm_call_index) DO NOTHING` in Supabase and maintains `inMemoryLLMUsageKeys` Set in memory.

#### 40. Can horizontal scaling cause duplicate billing records?
**Yes, under current code.** Because `request_id` is NOT propagated through BullMQ (Question #38), worker retries generate new `request_id` strings, causing `logLLMUsage` to treat retries as new requests and write duplicate financial ledger rows.

---

### Security & Operational Safety

#### 41. Are tenant authorization checks performed server-side?
Yes. All `DB` queries and API routes require explicit `tenantId` parameters and enforce RLS / explicit filtering.

#### 42. Are admin observability APIs protected?
Yes, protected by admin authorization tokens and session verification.

#### 43. Are secrets excluded from Redis job payloads?
Yes. Job payloads only carry `{ msg, inputTenantId }`. API keys are resolved securely from process env or `tenant_configs` DB table.

#### 44. Are customer messages unnecessarily persisted in queues?
BullMQ job payloads store the raw Baileys message object. `removeOnComplete: 100` and `removeOnFail: 200` retain these message payloads in Redis memory until pruned.

---

### Shutdown & Lifecycle Management

#### 45. Is graceful shutdown implemented?
Partially in `whatsapp.ts` for closing WASockets. BullMQ workers do not listen to `SIGTERM`/`SIGINT` for graceful closure.

#### 46. Does the worker stop accepting new jobs before shutdown?
No explicit `worker.close()` call is executed on process termination.

#### 47. Does it wait for active jobs?
No.

#### 48. Does it reconnect/recover automatically?
Yes. Watchdog timer in `whatsapp.ts` runs every 30s to recover disconnected sessions, and BullMQ auto-reconnects to Redis on network recovery.

---

### Empirical Scaling Envelope & Bottleneck

#### 49. What is the actual maximum safe worker concurrency?
Measured empirically in Phase 5 as **20 concurrent jobs per process node**, sustaining 100 concurrent requests / 250 RPS.

#### 50. What is the actual bottleneck?
1. **WhatsApp Session Collision:** Absence of distributed session locking prevents running multiple application/worker instances without Baileys socket conflicts.
2. **Missing Trace Propagation:** Lack of trace context propagation in BullMQ invalidates request correlation and idempotency across worker retries.
3. **LLM Provider API Rate Limits:** External provider 429s under burst conditions.

---

## Architectural Gaps Summary Table

| Functional Area | Current Implementation State | Horizontal Scaling Blocker |
|---|---|---|
| **WhatsApp Sessions** | Process-Memory Map (`baileysSessions`) | Multi-instance socket collision on same tenant |
| **Distributed Lock** | Redis with fallback to local JS Map | Node-local locks fail cross-instance synchronization |
| **BullMQ Jobs** | `Queue.add(jobName, payload)` without `jobId` | Enqueuing same message creates duplicate jobs |
| **Trace Context** | `AsyncLocalStorage` not passed to BullMQ | Request/Trace IDs lost; breaks billing idempotency |
| **Tenant Fairness** | Single global FIFO queue | One high-volume tenant starves all other tenants |
| **Backpressure** | Unbounded queue ingestion | Memory exhaustion under severe burst traffic |
| **Dead Letter Queue** | Discards failed jobs after 2 attempts | Zero visibility or replay capability for failed jobs |
| **Graceful Shutdown** | Workers killed mid-execution | Risk of duplicate side-effects during rolling restarts |

---

## Recommendation & Target Architecture for Phase 6 Implementation

To safely enable horizontal scaling across 10 to 1,000+ tenants without code rewrites or unnecessary complexity, implementation must proceed through Phase 6B–6L:

1. **Distributed Session Registry (Redis Leases):** Assign WhatsApp sockets to exactly one designated worker instance using auto-refreshing Redis lease keys (`lease:whatsapp:${tenantId}`).
2. **Deterministic BullMQ Job IDs:** Set `jobId = msg-${tenantId}-${providerMessageId}` to prevent duplicate job creation at the queue boundary.
3. **BullMQ Trace Context Propagation:** Inject `traceId`, `requestId`, `correlationId`, `tenantId`, `customerId` into job payloads and restore via `runWithTraceContext()` in workers.
4. **Per-Tenant Fair Queueing:** Implement grouped tenant queueing or token-bucket tenant throttlers in BullMQ workers.
5. **Dead Letter Queue & Admin Replay:** Route failed jobs to `whatsapp-dlq` and expose replay endpoints in the Admin Observability Dashboard.
