import crypto from "crypto";
import { getRedisClient, isRedisReady } from "./redis";
import { getInstanceId } from "./instance-identity";

export interface LockOptions {
  ttlMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  ownerId?: string;
}

export interface LockResult {
  success: boolean;
  lock?: LockHandle;
  reason?: "acquired" | "already_locked" | "redis_unavailable" | "error" | "timeout";
  error?: any;
}

export interface LockHandle {
  key: string;
  ownerId: string;
  token: string;
  fullToken: string;
  ttlMs: number;
  acquiredAt: number;
  renew: (newTtlMs?: number) => Promise<boolean>;
  release: () => Promise<boolean>;
  isOwner: () => Promise<boolean>;
}

// Atomic Release LUA Script
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

// Atomic Renewal LUA Script
const RENEW_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
else
  return 0
end
`;

// Atomic Ownership Verification LUA Script
const VERIFY_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return 1
else
  return 0
end
`;

export class DistributedLock {
  /**
   * Acquire a distributed lock on Redis with token fencing and TTL.
   */
  static async acquire(key: string, options: LockOptions = {}): Promise<LockResult> {
    const redis = getRedisClient();
    if (!redis) {
      return { success: false, reason: "redis_unavailable" };
    }

    const ttlMs = options.ttlMs || 30000;
    const ownerId = options.ownerId || getInstanceId();
    const token = crypto.randomUUID().replace(/-/g, "").substring(0, 12);
    const fullToken = `${ownerId}:${token}`;
    const retryAttempts = options.retryAttempts !== undefined ? options.retryAttempts : 0;
    const retryDelayMs = options.retryDelayMs || 100;

    let attempt = 0;
    while (attempt <= retryAttempts) {
      try {
        const res = await redis.set(key, fullToken, "PX", ttlMs, "NX");
        if (res === "OK") {
          const acquiredAt = Date.now();
          const handle: LockHandle = {
            key,
            ownerId,
            token,
            fullToken,
            ttlMs,
            acquiredAt,
            renew: async (newTtlMs?: number) => {
              return DistributedLock.renew(key, fullToken, newTtlMs || ttlMs);
            },
            release: async () => {
              return DistributedLock.release(key, fullToken);
            },
            isOwner: async () => {
              return DistributedLock.isOwner(key, fullToken);
            },
          };
          return { success: true, lock: handle, reason: "acquired" };
        }
      } catch (err: any) {
        console.warn(`[DistributedLock] Error attempting to acquire lock on ${key}:`, err.message || err);
        return { success: false, reason: "redis_unavailable", error: err };
      }

      attempt++;
      if (attempt <= retryAttempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    return { success: false, reason: "already_locked" };
  }

  /**
   * Renew an existing lock atomically using LUA script.
   */
  static async renew(key: string, fullToken: string, ttlMs: number): Promise<boolean> {
    const redis = getRedisClient();
    if (!redis) return false;

    try {
      const result = await redis.eval(RENEW_SCRIPT, 1, key, fullToken, ttlMs);
      return result === 1;
    } catch (err: any) {
      console.warn(`[DistributedLock] Lock renewal failed for ${key}:`, err.message || err);
      return false;
    }
  }

  /**
   * Release a lock atomically using LUA script (prevents deleting another instance's lock).
   */
  static async release(key: string, fullToken: string): Promise<boolean> {
    const redis = getRedisClient();
    if (!redis) return false;

    try {
      const result = await redis.eval(RELEASE_SCRIPT, 1, key, fullToken);
      return result === 1;
    } catch (err: any) {
      console.warn(`[DistributedLock] Lock release failed for ${key}:`, err.message || err);
      return false;
    }
  }

  /**
   * Verify if the specified fullToken is current lock owner.
   */
  static async isOwner(key: string, fullToken: string): Promise<boolean> {
    const redis = getRedisClient();
    if (!redis) return false;

    try {
      const result = await redis.eval(VERIFY_SCRIPT, 1, key, fullToken);
      return result === 1;
    } catch (err: any) {
      console.warn(`[DistributedLock] Lock ownership verification failed for ${key}:`, err.message || err);
      return false;
    }
  }

  /**
   * Inspect current lock owner without modifying TTL.
   */
  static async getOwnerInfo(key: string): Promise<{ ownerId?: string; fullToken?: string } | null> {
    const redis = getRedisClient();
    if (!redis) return null;

    try {
      const val = await redis.get(key);
      if (!val) return null;
      const parts = val.split(":");
      return { ownerId: parts[0], fullToken: val };
    } catch (err: any) {
      return null;
    }
  }
}
