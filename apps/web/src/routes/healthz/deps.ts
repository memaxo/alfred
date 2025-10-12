import { healthChecksTotal } from "@alfred/api/metrics";
import { getRedis } from "@alfred/auth/redis";
import { db } from "@alfred/db";
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";

export const Route = createFileRoute("/healthz/deps")({
	server: {
		handlers: {
			GET: async () => {
				try {
					await db.execute(sql`select 1`);
					const redis = getRedis();
					if (redis) {
						await redis.ping();
					}

					healthChecksTotal.labels("deps", "ok").inc();

					return new Response(JSON.stringify({ ok: true }), {
						headers: {
							"content-type": "application/json",
						},
					});
				} catch (error) {
					const message = error instanceof Error ? error.message : "deps_failed";
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
