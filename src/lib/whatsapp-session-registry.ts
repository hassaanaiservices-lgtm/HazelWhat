import pino from "pino";
import { DistributedLock, LockHandle } from "./distributed-lock";
import { getInstanceId } from "./instance-identity";
import { getRedisClient } from "./redis";

const logger = pino({ name: "whatsapp-session-registry" });

export function getSessionLockConfig() {
  const ttlMs = parseInt(process.env.WHATSAPP_SESSION_LOCK_TTL_MS || "30000", 10);
  const renewMs = parseInt(process.env.WHATSAPP_SESSION_LOCK_RENEW_MS || "10000", 10);

  if (renewMs >= ttlMs) {
    console.warn(
      `[SessionRegistry Config] WHATSAPP_SESSION_LOCK_RENEW_MS (${renewMs}ms) must be less than TTL (${ttlMs}ms). Adjusting renewMs to ${Math.floor(ttlMs / 3)}ms.`
    );
    return { ttlMs, renewMs: Math.floor(ttlMs / 3) };
  }

  return { ttlMs, renewMs };
}

export interface SessionRegistryRecord {
  tenantId: string;
  instanceId: string;
  sessionId: string;
  status: "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "FAILED" | "RECONNECTING";
  leaseExpiresAt: number;
  lastHeartbeatAt: number;
  connectionState: string;
  createdAt: string;
  updatedAt: string;
}

const activeHeartbeats = new Map<
  string,
  {
    lockHandle: LockHandle;
    timer: NodeJS.Timeout;
    onOwnershipLost?: () => void;
    consecutiveFailures: number;
  }
>();

export class WhatsAppSessionRegistry {
  static getLockKey(tenantId: string): string {
    return `lock:whatsapp-session:${tenantId}`;
  }

  static getRegistryKey(tenantId: string): string {
    return `registry:whatsapp-session:${tenantId}`;
  }

  /**
   * Attempt to acquire exclusive distributed ownership lease for a tenant WhatsApp session.
   */
  static async acquireLease(
    tenantId: string,
    onOwnershipLost?: () => void
  ): Promise<{ acquired: boolean; lockHandle?: LockHandle; record?: SessionRegistryRecord; reason?: string }> {
    const instanceId = getInstanceId();
    const lockKey = this.getLockKey(tenantId);
    const registryKey = this.getRegistryKey(tenantId);
    const { ttlMs, renewMs } = getSessionLockConfig();

    // 0. If this instance already has an active heartbeat for this tenant, reuse it.
    const active = activeHeartbeats.get(tenantId);
    if (active) {
      logger.info({
        event: "session_lock_reused",
        tenant_id: tenantId,
        instance_id: instanceId,
      });
      if (onOwnershipLost) {
        active.onOwnershipLost = onOwnershipLost;
      }
      
      const redis = getRedisClient();
      let record: SessionRegistryRecord | undefined = undefined;
      if (redis) {
        try {
          const recordStr = await redis.get(registryKey);
          if (recordStr) {
            record = JSON.parse(recordStr);
          }
        } catch (_) {}
      }
      if (!record) {
        record = {
          tenantId,
          instanceId,
          sessionId: `sess_${tenantId}_${active.lockHandle.token}`,
          status: "CONNECTING",
          leaseExpiresAt: Date.now() + ttlMs,
          lastHeartbeatAt: Date.now(),
          connectionState: "initiating",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      return { acquired: true, lockHandle: active.lockHandle, record };
    }

    // Acquire atomic Redis lock
    const lockRes = await DistributedLock.acquire(lockKey, {
      ttlMs,
      ownerId: instanceId,
      retryAttempts: 0, // Fail fast if already owned by another instance
    });

    if (!lockRes.success || !lockRes.lock) {
      const existingOwner = await DistributedLock.getOwnerInfo(lockKey);
      logger.info({
        event: "session_lock_denied",
        tenant_id: tenantId,
        instance_id: instanceId,
        current_owner: existingOwner?.ownerId || "unknown",
        reason: lockRes.reason,
      });
      return { acquired: false, reason: lockRes.reason || "already_owned" };
    }

    const lockHandle = lockRes.lock;
    const now = Date.now();
    const leaseExpiresAt = now + ttlMs;
    const sessionId = `sess_${tenantId}_${lockHandle.token}`;

    const record: SessionRegistryRecord = {
      tenantId,
      instanceId,
      sessionId,
      status: "CONNECTING",
      leaseExpiresAt,
      lastHeartbeatAt: now,
      connectionState: "initiating",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store shared session record in Redis
    const redis = getRedisClient();
    if (redis) {
      try {
        await redis.set(registryKey, JSON.stringify(record), "PX", ttlMs * 2);
      } catch (err: any) {
        console.warn(`[SessionRegistry] Failed to write registry metadata for ${tenantId}:`, err.message || err);
      }
    }

    logger.info({
      event: "session_lock_acquired",
      tenant_id: tenantId,
      instance_id: instanceId,
      session_id: sessionId,
      lease_expires_at: leaseExpiresAt,
    });

    // Setup periodic lease renewal timer
    this.startHeartbeat(tenantId, lockHandle, onOwnershipLost);

    return { acquired: true, lockHandle, record };
  }

  /**
   * Start periodic background lease renewal heartbeat loop.
   */
  private static startHeartbeat(tenantId: string, lockHandle: LockHandle, onOwnershipLost?: () => void) {
    this.stopHeartbeat(tenantId);

    const { ttlMs, renewMs } = getSessionLockConfig();

    const timer = setInterval(async () => {
      const active = activeHeartbeats.get(tenantId);
      if (!active) return;

      const renewed = await lockHandle.renew(ttlMs);
      const now = Date.now();

      if (renewed) {
        active.consecutiveFailures = 0;
        const redis = getRedisClient();
        if (redis) {
          try {
            const registryKey = this.getRegistryKey(tenantId);
            const recordStr = await redis.get(registryKey);
            if (recordStr) {
              const record: SessionRegistryRecord = JSON.parse(recordStr);
              record.lastHeartbeatAt = now;
              record.leaseExpiresAt = now + ttlMs;
              record.updatedAt = new Date().toISOString();
              await redis.set(registryKey, JSON.stringify(record), "PX", ttlMs * 2);
            }
          } catch (_) {}
        }

        logger.debug({
          event: "session_lock_renewed",
          tenant_id: tenantId,
          instance_id: getInstanceId(),
          lease_expires_at: now + ttlMs,
        });
      } else {
        active.consecutiveFailures++;
        console.warn(
          `[SessionRegistry] Lease renewal failed for tenant ${tenantId} (Attempt ${active.consecutiveFailures}/3)`
        );

        if (active.consecutiveFailures >= 3) {
          logger.error({
            event: "session_lock_lost",
            tenant_id: tenantId,
            instance_id: getInstanceId(),
            reason: "heartbeat_renewal_exhausted",
          });

          this.stopHeartbeat(tenantId);

          if (active.onOwnershipLost) {
            try {
              active.onOwnershipLost();
            } catch (err) {
              console.error(`[SessionRegistry] Error executing ownership lost callback for ${tenantId}:`, err);
            }
          }
        }
      }
    }, renewMs);

    activeHeartbeats.set(tenantId, {
      lockHandle,
      timer,
      onOwnershipLost,
      consecutiveFailures: 0,
    });
  }

  /**
   * Stop lease renewal timer for tenant.
   */
  static stopHeartbeat(tenantId: string) {
    const existing = activeHeartbeats.get(tenantId);
    if (existing) {
      clearInterval(existing.timer);
      activeHeartbeats.delete(tenantId);
    }
  }

  /**
   * Update shared connection status in registry (e.g. CONNECTED / DISCONNECTED).
   */
  static async updateStatus(tenantId: string, status: SessionRegistryRecord["status"], connectionState = "active") {
    const active = activeHeartbeats.get(tenantId);
    if (!active) return;

    const redis = getRedisClient();
    if (!redis) return;

    try {
      const registryKey = this.getRegistryKey(tenantId);
      const recordStr = await redis.get(registryKey);
      if (recordStr) {
        const record: SessionRegistryRecord = JSON.parse(recordStr);
        record.status = status;
        record.connectionState = connectionState;
        record.updatedAt = new Date().toISOString();
        await redis.set(registryKey, JSON.stringify(record), "PX", getSessionLockConfig().ttlMs * 2);
      }
    } catch (err: any) {
      console.warn(`[SessionRegistry] Failed to update status for ${tenantId}:`, err.message || err);
    }
  }

  /**
   * Safely release distributed lease ownership for a tenant.
   */
  static async releaseLease(tenantId: string): Promise<boolean> {
    const active = activeHeartbeats.get(tenantId);
    const instanceId = getInstanceId();

    this.stopHeartbeat(tenantId);

    if (active) {
      const released = await active.lockHandle.release();
      const redis = getRedisClient();
      if (redis) {
        try {
          await redis.del(this.getRegistryKey(tenantId));
        } catch (_) {}
      }

      logger.info({
        event: "session_lock_released",
        tenant_id: tenantId,
        instance_id: instanceId,
        released_successfully: released,
      });

      return released;
    }

    return false;
  }

  /**
   * Verify if current instance holds valid active lease for tenant.
   */
  static async isOwner(tenantId: string): Promise<boolean> {
    const active = activeHeartbeats.get(tenantId);
    if (!active) return false;
    return active.lockHandle.isOwner();
  }

  /**
   * Retrieve current registry record for tenant from Redis.
   */
  static async getRecord(tenantId: string): Promise<SessionRegistryRecord | null> {
    const redis = getRedisClient();
    if (!redis) return null;

    try {
      const str = await redis.get(this.getRegistryKey(tenantId));
      if (!str) return null;
      return JSON.parse(str);
    } catch (_) {
      return null;
    }
  }

  /**
   * Release all leases owned by current instance during graceful shutdown.
   */
  static async releaseAllOwnedLeases(): Promise<number> {
    const tenantIds = Array.from(activeHeartbeats.keys());
    let releasedCount = 0;

    for (const tenantId of tenantIds) {
      try {
        const released = await this.releaseLease(tenantId);
        if (released) releasedCount++;
      } catch (err) {
        console.error(`[SessionRegistry] Error releasing lease for ${tenantId} during shutdown:`, err);
      }
    }

    return releasedCount;
  }
}
