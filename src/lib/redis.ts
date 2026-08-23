import Redis from "ioredis";

const globalForRedis = global as unknown as {
  redisClient: Redis | null;
  mockRedisClient: any | null;
};

export function getRedisUrl(): string | undefined {
  return process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL;
}

export function getRedisClient(): Redis | null {
  if (globalForRedis.mockRedisClient) {
    return globalForRedis.mockRedisClient;
  }

  if (globalForRedis.redisClient) {
    return globalForRedis.redisClient;
  }

  const url = getRedisUrl();
  if (!url) {
    return null;
  }

  try {
    const client = new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy(times) {
        // Bounded exponential backoff with cap at 5 seconds
        return Math.min(times * 200, 5000);
      },
    });

    client.on("error", (err) => {
      // Suppress spammy unhandled error warnings in logs during network glitches
      if (process.env.NODE_ENV !== "test") {
        console.warn("[Redis] Connection error:", err.message || err);
      }
    });

    // Auto-connect lazily or synchronously attempt connection
    client.connect().catch((err) => {
      console.warn("[Redis] Initial lazy connection failed:", err.message || err);
    });

    globalForRedis.redisClient = client;
    return client;
  } catch (err: any) {
    console.error("[Redis] Failed to instantiate Redis client:", err.message || err);
    return null;
  }
}

export function setMockRedisClient(mock: any | null): void {
  globalForRedis.mockRedisClient = mock;
}

export function isRedisReady(): boolean {
  if (globalForRedis.mockRedisClient) return true;
  const client = globalForRedis.redisClient;
  return !!client && (client.status === "ready" || client.status === "connect");
}

export async function closeRedisConnection(): Promise<void> {
  if (globalForRedis.redisClient) {
    try {
      await globalForRedis.redisClient.quit();
    } catch (_) {
      try {
        globalForRedis.redisClient.disconnect();
      } catch (__) {}
    }
    globalForRedis.redisClient = null;
  }
  globalForRedis.mockRedisClient = null;
}
