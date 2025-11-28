import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";

export const Route = createFileRoute("/healthz/deps")({
  server: {
    handlers: {
      GET: async () => {
        const { healthChecksTotal } = await import("@alfred/api/metrics");
        const { getRedis } = await import("@alfred/auth/redis");
        const { db } = await import("@alfred/db");

        try {
          await db.execute(sql`select 1`);
          const { isRedisHealthy } = await import("@alfred/auth/redis");
          const redisHealthy = await isRedisHealthy();

          healthChecksTotal.labels("deps", "ok").inc();

          return Response.json({
            ok: true,
            redis: redisHealthy ? "ok" : "unavailable",
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "deps_failed";
          healthChecksTotal.labels("deps", "fail").inc();
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: {
              "content-type": "application/json",
            },
          });
        }
      },
    },
  },
});
