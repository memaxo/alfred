import type { RedisClientType } from "redis";
import { createClient } from "redis";

let client: RedisClientType | null = null;
let status: "init" | "ok" | "err" = "init";

export function getRedis(): RedisClientType | null {
  const url = process.env.REDIS_URL;
  if (!url || url === "false") {
    return null;
  }

  if (client && status === "ok") {
    return client;
  }

  if (status === "err") {
    return null;
  }

  try {
    client = createClient({ url });
    client.on("error", () => {
      status = "err";
    });
    // fire-and-forget connect; consumers can still get the client immediately
    void client.connect().then(
      () => {
        status = "ok";
      },
      () => {
        status = "err";
      },
    );
    return client;
  } catch {
    status = "err";
    client = null;
    return null;
  }
}
