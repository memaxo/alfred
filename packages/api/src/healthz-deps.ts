import { isRedisHealthy } from "@alfred/auth/redis";
import { db } from "@alfred/db";
import { sql } from "drizzle-orm";

import { healthChecksTotal } from "./metrics";

export async function handleHealthzDeps(): Promise<Response> {
  try {
    await db.execute(sql`select 1`);
    const redisHealthy = await isRedisHealthy();

    healthChecksTotal.labels("deps", "ok").inc();

    return Response.json(
      {
        ok: true,
        redis: redisHealthy ? "ok" : "unavailable",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "deps_failed";
    healthChecksTotal.labels("deps", "fail").inc();
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: {
        "content-type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }
}
