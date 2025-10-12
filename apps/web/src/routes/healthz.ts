import { healthChecksTotal } from "@alfred/api/metrics";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/healthz")({
	server: {
		handlers: {
			GET: async () => {
				const body = JSON.stringify({
					ok: true,
					ts: Date.now(),
				});

				healthChecksTotal.labels("app", "ok").inc();

				return new Response(body, {
					headers: {
						"content-type": "application/json",
					},
				});
			},
		},
	},
});
