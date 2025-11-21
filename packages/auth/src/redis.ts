import { redis as defaultRedis, RedisClient } from "bun";

let client: RedisClient | null = null;
let status: "init" | "ok" | "err" = "init";

export function getRedis(): RedisClient | null {
  const url = process.env.REDIS_URL;
  if (!url || url === "false") {
    return null;
  }

  if (client && status === "ok") {
    return client;
  }

  if (status === "err") {
    // Retry init after failure if requested (simplistic retry)
    // For now, stick to returning null to fallback to in-memory
    return null;
  }

  try {
    // Bun's RedisClient is built on top of ioredis but optimized
    // It handles connection pooling internally
    client = url ? new RedisClient(url, {
      // @ts-expect-error - Bun Redis options might differ from types
      connectTimeout: 5000,
      // enableOfflineQueue: false, // Not supported in Bun types?
    }) : defaultRedis;
    
    client.onclose = () => {
      status = "err";
      client = null; // Allow reconnection attempt next time
    };
    client.onconnect = () => {
      status = "ok";
    };
    client.onerror = (err) => {
      console.error("[redis] connection error:", err);
      status = "err";
    };

    // Initial connection check (fire and forget to not block startup)
    void client.connect().then(
      () => {
        status = "ok";
      },
      (err) => {
        console.error("[redis] initial connection failed:", err);
        status = "err";
        client = null;
      }
    );
    return client;
  } catch (error) {
    console.error("[redis] client creation failed:", error);
    status = "err";
    client = null;
    return null;
  }
}
