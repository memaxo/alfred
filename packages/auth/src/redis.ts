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
    return null;
  }

  try {
    client = url ? new RedisClient(url) : defaultRedis;
    client.onclose = () => {
      status = "err";
    };
    client.onconnect = () => {
      status = "ok";
    };
    void client.connect().then(
      () => {
        status = "ok";
      },
      () => {
        status = "err";
      }
    );
    return client;
  } catch {
    status = "err";
    client = null;
    return null;
  }
}
