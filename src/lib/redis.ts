// src/lib/redis.ts
import Redis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var redis: Redis | undefined;
}

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL environment variable is not set");
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });

  client.on("error", (err) => {
    console.error("Redis client error:", err);
  });

  return client;
}

const redis = global.redis || createRedisClient();

if (process.env.NODE_ENV !== "production") {
  global.redis = redis;
}

export { redis };
