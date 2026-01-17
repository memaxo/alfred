import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/healthz/deps")({
  server: {
    handlers: {
      GET: async () => {
        const metricsPkg = "@alfred/api/metrics";
        const redisPkg = "@alfred/auth/redis";
        const dbPkg = "@alfred/db";
        const drizzlePkg = "drizzle-orm";

        const [{ healthChecksTotal }, redis, { db }, { sql }] =
          await Promise.all([
            import(/* @vite-ignore */ metricsPkg),
            import(/* @vite-ignore */ redisPkg),
            import(/* @vite-ignore */ dbPkg),
            import(/* @vite-ignore */ drizzlePkg),
          ]);
        const { isRedisHealthy } = redis;

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
          const message =
            error instanceof Error ? error.message : "deps_failed";
          healthChecksTotal.labels("deps", "fail").inc();
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: {
              "content-type": "application/json",
              "Cache-Control": "no-store",
            },
          });
        }
      },
    },
  },
});
