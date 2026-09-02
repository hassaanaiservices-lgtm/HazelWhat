import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import pino from "pino";
import {
  TraceContextData,
  createTraceContext,
  runWithTraceContext,
  getCurrentTraceContext,
  sanitizeHeaderId,
} from "./trace-context";
import { getRedisClient } from "./redis";
import { logAppError } from "./observability-store";
import { WhatsAppSessionRegistry } from "./whatsapp-session-registry";

const logger = pino({ name: "queue-manager" });

// Explicit Backpressure Limits (Configured for Production Concurrency)
export const CONCURRENCY_LIMIT = parseInt(process.env.QUEUE_CONCURRENCY_LIMIT || "50", 10);
export const MAX_TENANT_CONCURRENCY = parseInt(process.env.MAX_TENANT_CONCURRENCY || "25", 10);
export const MAX_GLOBAL_QUEUE_DEPTH = 5000;
export const MAX_TENANT_QUEUE_BACKLOG = 1000;
export const MAX_RETRY_BACKLOG = 500;
export const MAX_MEMORY_QUEUE_SIZE = 1000;
export const MAX_JOB_PAYLOAD_SIZE = 128 * 1024; // 128 KB limit

export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableError";
  }
}

export class PayloadTooLargeError extends NonRetryableError {
  constructor(size: number) {
    super(`PayloadTooLargeError: Job payload size (${size} bytes) exceeds 128KB limit`);
    this.name = "PayloadTooLargeError";
  }
}

export class TenantBacklogExceededError extends NonRetryableError {
  constructor(tenantId: string, count: number) {
    super(`TenantBacklogExceededError: Tenant ${tenantId} backlog (${count}) exceeds limit of ${MAX_TENANT_QUEUE_BACKLOG}`);
    this.name = "TenantBacklogExceededError";
  }
}

export interface WhatsAppJobPayload {
  msg: any;
  tenantId: string;
  customerId: string;
  conversationId: string;
  traceContext: TraceContextData;
}

export interface DLQRecord {
  id: string;
  jobId: string;
  tenantId: string;
  customerId: string;
  requestId: string;
  traceId: string;
  correlationId: string;
  payload: WhatsAppJobPayload;
  attemptsMade: number;
  failedReason: string;
  failedAt: string;
}

let messageQueue: Queue<WhatsAppJobPayload> | null = null;
let messageWorker: Worker<WhatsAppJobPayload> | null = null;
let isShuttingDown = false;

// Concurrency & Backlog metrics tracking
const tenantActiveWorkers = new Map<string, number>();
const tenantBacklogCount = new Map<string, number>();

// In-Memory Queue & DLQ Store (used when Redis is offline or testing)
interface MemoryJob {
  id: string;
  payload: WhatsAppJobPayload;
  timestamp: number;
}

const memoryQueue: MemoryJob[] = [];
const memoryDedupeSet = new Set<string>();
const dlqStore = new Map<string, DLQRecord>();
let activeMemoryWorkers = 0;
let registeredProcessor: ((payload: WhatsAppJobPayload) => Promise<void>) | null = null;

/**
 * Generate a deterministic job ID using tenant namespace + WhatsApp message ID.
 */
export function generateDeterministicJobId(tenantId: string, rawMessageId?: string): string {
  const cleanTenant = sanitizeHeaderId(tenantId, "t");
  const cleanMsgId = rawMessageId ? rawMessageId.replace(/[^a-zA-Z0-9_-]/g, "") : `fallback_${Date.now()}`;
  return `msg_${cleanTenant}_${cleanMsgId}`;
}

export function initializeQueueManager(): Queue<WhatsAppJobPayload> | null {
  const redis = getRedisClient();
  if (redis && !messageQueue) {
    try {
      messageQueue = new Queue<WhatsAppJobPayload>("whatsapp-message-queue", {
        connection: redis,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 1000,
          },
          removeOnComplete: 200,
          removeOnFail: 500,
        },
      });
      console.log(`[QueueManager] BullMQ connected to Redis. Concurrency: ${CONCURRENCY_LIMIT}, Tenant Max: ${MAX_TENANT_CONCURRENCY}.`);
    } catch (err: any) {
      console.error("[QueueManager] Failed to initialize BullMQ Queue:", err.message || err);
    }
  }
  return messageQueue;
}

/**
 * Helper to check if error is non-retryable
 */
export function isNonRetryableError(err: any): boolean {
  if (!err) return false;
  if (err instanceof NonRetryableError || err.isNonRetryable === true) return true;
  const msg = (err.message || String(err)).toLowerCase();
  return (
    msg.includes("nonretryable") ||
    msg.includes("circuit-open") ||
    msg.includes("no api keys") ||
    msg.includes("authentication") ||
    msg.includes("unauthorized") ||
    msg.includes("invalid key") ||
    msg.includes("malformed") ||
    msg.includes("budget limit exceeded") ||
    msg.includes("400 bad request")
  );
}

/**
 * Enqueue incoming WhatsApp message with deterministic jobId, backpressure controls, and trace context.
 */
export async function enqueueWhatsAppMessageJob(
  msg: any,
  inputTenantId: string,
  customerId: string,
  traceContextInput?: Partial<TraceContextData>
): Promise<{ success: boolean; jobId: string; deduplicated: boolean; reason?: string }> {
  if (isShuttingDown) {
    logger.warn({ event: "enqueue_rejected_shutdown", tenant_id: inputTenantId });
    return { success: false, jobId: "", deduplicated: false, reason: "server_shutting_down" };
  }

  const rawMsgId = msg?.key?.id;
  const jobId = generateDeterministicJobId(inputTenantId, rawMsgId);

  // 1. Trace Context
  const existingCtx = getCurrentTraceContext();
  const traceContext: TraceContextData = traceContextInput
    ? createTraceContext(traceContextInput)
    : existingCtx
    ? { ...existingCtx }
    : createTraceContext({
        requestId: `req_wa_${inputTenantId}_${rawMsgId || Date.now()}`,
        traceId: `trc_wa_${inputTenantId}_${rawMsgId || Date.now()}`,
        tenantId: inputTenantId,
        customerId,
        conversationId: `conv_${inputTenantId}_${customerId}`,
        operation: "process_whatsapp_message",
      });

  traceContext.tenantId = inputTenantId;
  traceContext.customerId = customerId;
  traceContext.conversationId = `conv_${inputTenantId}_${customerId}`;

  const sanitizedMsg = {
    key: {
      id: msg?.key?.id,
      remoteJid: msg?.key?.remoteJid,
      fromMe: msg?.key?.fromMe,
      remoteJidAlt: msg?.key?.remoteJidAlt,
    },
    messageTimestamp: msg?.messageTimestamp,
    message: msg?.message,
  };

  const payload: WhatsAppJobPayload = {
    msg: sanitizedMsg,
    tenantId: inputTenantId,
    customerId,
    conversationId: traceContext.conversationId,
    traceContext,
  };

  // 2. Payload Size Limit Guard (128 KB)
  const payloadSize = Buffer.byteLength(JSON.stringify(payload));
  if (payloadSize > MAX_JOB_PAYLOAD_SIZE) {
    logger.error({
      event: "job_payload_too_large",
      job_id: jobId,
      tenant_id: inputTenantId,
      size_bytes: payloadSize,
      max_bytes: MAX_JOB_PAYLOAD_SIZE,
    });
    throw new PayloadTooLargeError(payloadSize);
  }

  // 3. Global Queue Backpressure Guard (Max 1000)
  const totalQueueDepth = await getQueueLength();
  if (totalQueueDepth >= MAX_GLOBAL_QUEUE_DEPTH) {
    logger.warn({
      event: "queue_backpressure",
      job_id: jobId,
      tenant_id: inputTenantId,
      request_id: traceContext.requestId,
      trace_id: traceContext.traceId,
      queue_depth: totalQueueDepth,
    });
    return { success: false, jobId, deduplicated: false, reason: "memory_queue_full" };
  }

  // 4. Per-Tenant Backlog Backpressure Guard (Max 200)
  const currentTenantBacklog = tenantBacklogCount.get(inputTenantId) || 0;
  if (currentTenantBacklog >= MAX_TENANT_QUEUE_BACKLOG) {
    logger.warn({
      event: "tenant_queue_limit",
      job_id: jobId,
      tenant_id: inputTenantId,
      request_id: traceContext.requestId,
      trace_id: traceContext.traceId,
      backlog: currentTenantBacklog,
    });
    return { success: false, jobId, deduplicated: false, reason: "tenant_backlog_exceeded" };
  }

  const queue = initializeQueueManager();
  const redis = getRedisClient();

  if (queue && redis && (redis.status === "ready" || redis.status === "connect")) {
    try {
      const job = await queue.add("process_whatsapp_message", payload, { jobId });
      const deduplicated = job.id !== jobId;

      if (!deduplicated) {
        tenantBacklogCount.set(inputTenantId, currentTenantBacklog + 1);
      }

      logger.info({
        event: "job_enqueued",
        job_id: jobId,
        tenant_id: inputTenantId,
        customer_id: customerId,
        request_id: traceContext.requestId,
        trace_id: traceContext.traceId,
        deduplicated,
      });

      return { success: true, jobId, deduplicated };
    } catch (err: any) {
      console.warn(`[QueueManager] Redis enqueue failed for ${jobId}:`, err.message || err);
    }
  }

  // 5. In-Memory Queue Fallback (Redis Offline)
  if (memoryDedupeSet.has(jobId)) {
    logger.info({
      event: "job_deduplicated_memory",
      job_id: jobId,
      tenant_id: inputTenantId,
    });
    return { success: true, jobId, deduplicated: true };
  }

  if (memoryQueue.length >= MAX_MEMORY_QUEUE_SIZE) {
    logger.error({
      event: "queue_backpressure_memory_full",
      queue_length: memoryQueue.length,
      tenant_id: inputTenantId,
      request_id: traceContext.requestId,
    });
    return { success: false, jobId, deduplicated: false, reason: "memory_queue_full" };
  }

  memoryDedupeSet.add(jobId);
  if (memoryDedupeSet.size > 5000) {
    const firstKey = memoryDedupeSet.values().next().value;
    if (firstKey) memoryDedupeSet.delete(firstKey);
  }

  memoryQueue.push({
    id: jobId,
    payload,
    timestamp: Date.now(),
  });

  tenantBacklogCount.set(inputTenantId, currentTenantBacklog + 1);
  triggerMemoryWorkers();
  return { success: true, jobId, deduplicated: false };
}

/**
 * Move job to DLQ (Dead-Letter Queue) and record poison message details
 */
export async function moveToDlq(payload: WhatsAppJobPayload, err: any, attemptsMade = 3): Promise<DLQRecord> {
  const jobId = generateDeterministicJobId(payload.tenantId, payload.msg?.key?.id);
  const dlqRecord: DLQRecord = {
    id: `dlq_${jobId}_${Date.now()}`,
    jobId,
    tenantId: payload.tenantId,
    customerId: payload.customerId,
    requestId: payload.traceContext.requestId,
    traceId: payload.traceContext.traceId,
    correlationId: payload.traceContext.correlationId,
    payload,
    attemptsMade,
    failedReason: err?.message || String(err),
    failedAt: new Date().toISOString(),
  };

  dlqStore.set(jobId, dlqRecord);

  logger.error({
    event: "job_dlq",
    event_type: "job_poison_detected",
    job_id: jobId,
    tenant_id: payload.tenantId,
    customer_id: payload.customerId,
    request_id: payload.traceContext.requestId,
    traceId: payload.traceContext.traceId,
    attempts: attemptsMade,
    failed_reason: dlqRecord.failedReason,
  });

  await logAppError({
    service: "queue-manager",
    operation: "dlq_poison_message",
    error: err,
    tenantId: payload.tenantId,
    severity: "high",
    metadata: { jobId, attemptsMade, requestId: payload.traceContext.requestId },
  });

  return dlqRecord;
}

export function registerQueueWorker(processor: (payload: WhatsAppJobPayload) => Promise<void>) {
  registeredProcessor = processor;
  const redis = getRedisClient();

  if (redis && !messageWorker) {
    messageWorker = new Worker<WhatsAppJobPayload>(
      "whatsapp-message-queue",
      async (job: Job<WhatsAppJobPayload>) => {
        const { traceContext, tenantId } = job.data;
        const attempt = job.attemptsMade + 1;

        // Active concurrency tracking
        const activeCount = tenantActiveWorkers.get(tenantId) || 0;
        tenantActiveWorkers.set(tenantId, activeCount + 1);

        try {
          await runWithTraceContext(traceContext, async () => {
            logger.info({
              event: "worker_job_started",
              job_id: job.id,
              attempt,
              tenant_id: tenantId,
              request_id: traceContext.requestId,
              trace_id: traceContext.traceId,
            });

            await processor(job.data);
          });
        } catch (err: any) {
          if (isNonRetryableError(err) || attempt >= 3) {
            await moveToDlq(job.data, err, attempt);
            throw new NonRetryableError(err.message || String(err));
          } else {
            logger.warn({
              event: "job_retry",
              job_id: job.id,
              attempt,
              tenant_id: tenantId,
              request_id: traceContext.requestId,
              error: err.message,
            });
            throw err;
          }
        } finally {
          const currentCount = tenantActiveWorkers.get(tenantId) || 1;
          tenantActiveWorkers.set(tenantId, Math.max(0, currentCount - 1));

          const currentBacklog = tenantBacklogCount.get(tenantId) || 1;
          tenantBacklogCount.set(tenantId, Math.max(0, currentBacklog - 1));
        }
      },
      {
        connection: redis,
        concurrency: CONCURRENCY_LIMIT,
      }
    );

    messageWorker.on("failed", (job, err) => {
      if (job) {
        logger.error({
          event: "worker_job_failed",
          job_id: job.id,
          tenant_id: job.data.tenantId,
          request_id: job.data.traceContext?.requestId,
          error_message: err.message,
        });
      }
    });

    messageWorker.on("completed", (job) => {
      logger.info({
        event: "worker_job_completed",
        job_id: job.id,
        tenant_id: job.data.tenantId,
        request_id: job.data.traceContext?.requestId,
      });
    });

    // Catch unhandled worker-level errors (Redis disconnects, BullMQ internal crashes)
    messageWorker.on("error", (err) => {
      logger.error({ event: "worker_error", error: err.message });
      console.error("[QueueManager] BullMQ Worker error:", err.message);
    });

    // ─── Worker Resurrection Watchdog ────────────────────────────────────────
    // Checks every 60s if the BullMQ worker is still alive. If it has closed
    // or crashed, it tears it down and re-registers a fresh worker.
    // This is the permanent fix for "bot stops replying" after Redis blips.
    const workerWatchdog = setInterval(async () => {
      if (isShuttingDown) {
        clearInterval(workerWatchdog);
        return;
      }
      try {
        const workerClosed = !messageWorker || (messageWorker as any).closing || (messageWorker as any).closed;
        const redisOk = !!getRedisClient() && (getRedisClient()!.status === "ready" || getRedisClient()!.status === "connect");

        if (workerClosed && redisOk && registeredProcessor) {
          console.warn("[QueueManager] ⚠️ BullMQ Worker detected as dead. Resurrecting worker...");
          try {
            if (messageWorker) {
              await messageWorker.close().catch(() => {});
            }
          } catch (_) {}
          messageWorker = null;
          // Re-register fresh worker
          registerQueueWorker(registeredProcessor);
          console.log("[QueueManager] ✅ BullMQ Worker resurrected successfully.");
        } else if (!workerClosed) {
          logger.debug({ event: "worker_health_ok", status: "alive" });
        }
      } catch (watchdogErr: any) {
        console.error("[QueueManager] Worker watchdog error:", watchdogErr.message);
      }
    }, 60000);
    // ─────────────────────────────────────────────────────────────────────────

  } else {
    triggerMemoryWorkers();
  }
}

function triggerMemoryWorkers() {
  if (!registeredProcessor || isShuttingDown) return;

  while (activeMemoryWorkers < CONCURRENCY_LIMIT && memoryQueue.length > 0) {
    const job = memoryQueue.shift();
    if (!job) break;

    activeMemoryWorkers++;
    const tenantId = job.payload.tenantId;
    const activeCount = tenantActiveWorkers.get(tenantId) || 0;
    tenantActiveWorkers.set(tenantId, activeCount + 1);

    (async (currentJob) => {
      try {
        await runWithTraceContext(currentJob.payload.traceContext, async () => {
          await registeredProcessor!(currentJob.payload);
        });
      } catch (err: any) {
        logger.error({
          event: "memory_worker_job_failed",
          job_id: currentJob.id,
          tenant_id: currentJob.payload.tenantId,
          error: err.message,
        });
        await moveToDlq(currentJob.payload, err, 1);
      } finally {
        activeMemoryWorkers--;
        const curr = tenantActiveWorkers.get(tenantId) || 1;
        tenantActiveWorkers.set(tenantId, Math.max(0, curr - 1));

        const currBacklog = tenantBacklogCount.get(tenantId) || 1;
        tenantBacklogCount.set(tenantId, Math.max(0, currBacklog - 1));

        triggerMemoryWorkers();
      }
    })(job);
  }
}

/**
 * Gracefully shutdown workers, drain jobs, and release WhatsApp leases
 */
export async function gracefulShutdownWorkers(timeoutMs = 5000): Promise<void> {
  isShuttingDown = true;
  logger.info({ event: "worker_shutdown_started", timeout_ms: timeoutMs });

  if (messageWorker) {
    try {
      await messageWorker.pause();
    } catch (_) {}
  }

  const startTime = Date.now();
  while ((activeMemoryWorkers > 0 || Array.from(tenantActiveWorkers.values()).some((v) => v > 0)) && Date.now() - startTime < timeoutMs) {
    await new Promise((r) => setTimeout(r, 100));
  }

  // Release all held WhatsApp session leases on process shutdown
  try {
    await WhatsAppSessionRegistry.releaseAllOwnedLeases();
  } catch (e: any) {
    logger.error({ event: "shutdown_lease_release_failed", error: e.message });
  }

  logger.info({ event: "worker_shutdown_completed", elapsed_ms: Date.now() - startTime });
}

// --- Admin Operations & DLQ Management ---

export function getDlqRecords(tenantId?: string): DLQRecord[] {
  const records = Array.from(dlqStore.values());
  if (tenantId) {
    return records.filter((r) => r.tenantId === tenantId);
  }
  return records;
}

export function getDlqCount(tenantId?: string): number {
  return getDlqRecords(tenantId).length;
}

export async function retryDlqJob(jobId: string): Promise<boolean> {
  const dlqRecord = dlqStore.get(jobId);
  if (!dlqRecord) return false;

  dlqStore.delete(jobId);
  const { payload } = dlqRecord;

  const res = await enqueueWhatsAppMessageJob(
    payload.msg,
    payload.tenantId,
    payload.customerId,
    payload.traceContext
  );

  logger.info({
    event: "admin_dlq_job_retried",
    job_id: jobId,
    tenant_id: payload.tenantId,
    request_id: payload.traceContext.requestId,
    success: res.success,
  });

  return res.success;
}

export function discardDlqJob(jobId: string): boolean {
  const deleted = dlqStore.delete(jobId);
  if (deleted) {
    logger.info({ event: "admin_dlq_job_discarded", job_id: jobId });
  }
  return deleted;
}

export function getTenantActiveWorkersCount(tenantId: string): number {
  return tenantActiveWorkers.get(tenantId) || 0;
}

export function getTenantBacklog(tenantId: string): number {
  return tenantBacklogCount.get(tenantId) || 0;
}

export function getQueueMetrics() {
  const redis = getRedisClient();
  return {
    isRedisConnected: !!redis && (redis.status === "ready" || redis.status === "connect"),
    concurrencyLimit: CONCURRENCY_LIMIT,
    maxTenantConcurrency: MAX_TENANT_CONCURRENCY,
    maxGlobalQueueDepth: MAX_GLOBAL_QUEUE_DEPTH,
    maxTenantBacklog: MAX_TENANT_QUEUE_BACKLOG,
    inMemoryQueueLength: memoryQueue.length,
    activeMemoryWorkers,
    dlqCount: dlqStore.size,
    isShuttingDown,
  };
}

export async function getQueueLength(): Promise<number> {
  const queue = initializeQueueManager();
  const redis = getRedisClient();

  if (queue && redis && (redis.status === "ready" || redis.status === "connect")) {
    try {
      const counts = await queue.getJobCounts("active", "waiting", "delayed");
      return (counts.active || 0) + (counts.waiting || 0) + (counts.delayed || 0);
    } catch (err) {
      console.warn("[QueueManager] Failed to fetch Redis queue length:", err);
    }
  }
  return memoryQueue.length;
}

export function clearMemoryQueueForTesting() {
  memoryQueue.length = 0;
  memoryDedupeSet.clear();
  dlqStore.clear();
  tenantActiveWorkers.clear();
  tenantBacklogCount.clear();
  activeMemoryWorkers = 0;
  isShuttingDown = false;
}
