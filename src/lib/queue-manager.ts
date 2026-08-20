import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";

// Configurable concurrency limit for production WhatsApp processing
export const CONCURRENCY_LIMIT = 20;

let redisConnection: Redis | null = null;
let messageQueue: Queue | null = null;
let messageWorker: Worker | null = null;

const redisUrl = process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL;

if (redisUrl) {
  try {
    redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    messageQueue = new Queue("whatsapp-message-queue", {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 500,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });

    console.log(`[QueueManager] BullMQ connected to Redis (${redisUrl.replace(/:[^:@]+@/, ":***@")}). Concurrency: ${CONCURRENCY_LIMIT}.`);
  } catch (err: any) {
    console.error("[QueueManager] Failed to initialize Redis connection for BullMQ:", err.message || err);
  }
} else {
  console.log(`[QueueManager] REDIS_URL not configured. Using high-concurrency in-memory queue worker pool (Concurrency: ${CONCURRENCY_LIMIT}).`);
}

// In-Memory Queue Fallback for Local or Non-Redis Deployments
interface MemoryJob {
  id: string;
  msg: any;
  inputTenantId?: string;
  timestamp: number;
}

const memoryQueue: MemoryJob[] = [];
let activeMemoryWorkers = 0;
let registeredProcessor: ((msg: any, tenantId?: string) => Promise<void>) | null = null;

export async function enqueueWhatsAppMessageJob(
  msg: any,
  inputTenantId?: string
): Promise<void> {
  if (messageQueue && redisConnection) {
    const jobName = `msg-${msg.key?.id || Date.now()}`;
    await messageQueue.add(jobName, { msg, inputTenantId });
  } else {
    // High-performance in-memory worker queue fallback
    memoryQueue.push({
      id: msg.key?.id || String(Date.now()),
      msg,
      inputTenantId,
      timestamp: Date.now()
    });
    triggerMemoryWorkers();
  }
}

export function registerQueueWorker(processor: (msg: any, tenantId?: string) => Promise<void>) {
  registeredProcessor = processor;
  if (redisConnection) {
    messageWorker = new Worker(
      "whatsapp-message-queue",
      async (job: Job) => {
        const { msg, inputTenantId } = job.data;
        await processor(msg, inputTenantId);
      },
      {
        connection: redisConnection,
        concurrency: CONCURRENCY_LIMIT,
      }
    );

    messageWorker.on("failed", (job, err) => {
      console.error(`[QueueManager] Job ${job?.id} failed:`, err.message || err);
    });

    messageWorker.on("completed", (job) => {
      console.log(`[QueueManager] Job ${job?.id} processed successfully.`);
    });
  } else {
    // Trigger memory workers if jobs were queued before processor registration
    triggerMemoryWorkers();
  }
}

function triggerMemoryWorkers() {
  if (!registeredProcessor) return;

  while (activeMemoryWorkers < CONCURRENCY_LIMIT && memoryQueue.length > 0) {
    const job = memoryQueue.shift();
    if (!job) break;

    activeMemoryWorkers++;
    (async (currentJob) => {
      try {
        await registeredProcessor!(currentJob.msg, currentJob.inputTenantId);
      } catch (err: any) {
        console.error(`[QueueManager] In-memory job ${currentJob.id} failed:`, err.message || err);
      } finally {
        activeMemoryWorkers--;
        triggerMemoryWorkers();
      }
    })(job);
  }
}

export function getQueueMetrics() {
  return {
    isRedisConnected: !!redisConnection,
    concurrencyLimit: CONCURRENCY_LIMIT,
    inMemoryQueueLength: memoryQueue.length,
    activeMemoryWorkers,
  };
}
