import { randomUUID } from "crypto";
import os from "os";

const globalForInstance = global as unknown as {
  cachedInstanceId?: string;
};

export function getInstanceId(): string {
  if (globalForInstance.cachedInstanceId) {
    return globalForInstance.cachedInstanceId;
  }

  const envInstanceId = process.env.INSTANCE_ID;
  if (envInstanceId && envInstanceId.trim() !== "") {
    globalForInstance.cachedInstanceId = envInstanceId.trim();
    return globalForInstance.cachedInstanceId;
  }

  const hostname = os.hostname().replace(/[^a-zA-Z0-9_-]/g, "");
  const pid = process.pid;
  const suffix = randomUUID().replace(/-/g, "").substring(0, 8);

  const generatedId = `inst_${hostname}_${pid}_${suffix}`;
  globalForInstance.cachedInstanceId = generatedId;
  return generatedId;
}
