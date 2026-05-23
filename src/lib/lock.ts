// src/lib/lock.ts
/**
 * Distributed locking via Redis SET NX PX.
 *
 * We use a single-node Redis lock (Redlock would be needed for multi-node).
 * The lock key is namespaced per product+warehouse so reservations for
 * different SKUs don't block each other.
 *
 * Lock TTL is set conservatively (5 s) — far longer than the DB transaction
 * should take, but short enough that a crashed process doesn't block others.
 */

import { redis } from "./redis";

const LOCK_TTL_MS = 5000;

export async function withLock<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const lockKey = `lock:${key}`;
  const token = `${process.pid}-${Date.now()}-${Math.random()}`;

  // Spin-wait for the lock with a max wait of 3 s
  const maxWaitMs = 3000;
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const acquired = await redis.set(lockKey, token, "PX", LOCK_TTL_MS, "NX");
    if (acquired === "OK") {
      try {
        return await fn();
      } finally {
        // Only release our own lock (Lua script for atomicity)
        await redis.eval(
          `if redis.call("GET", KEYS[1]) == ARGV[1] then
             return redis.call("DEL", KEYS[1])
           else
             return 0
           end`,
          1,
          lockKey,
          token
        );
      }
    }

    // Back off briefly before retrying
    await sleep(50 + Math.random() * 50);
  }

  throw new Error(`Could not acquire lock for ${key} within ${maxWaitMs}ms`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
