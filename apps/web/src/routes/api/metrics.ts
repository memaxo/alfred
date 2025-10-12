import { metricsContentType, getMetricsSnapshot } from "@alfred/api/metrics";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/metrics")({
  server: {
    handlers: {
      GET: async () => {
        const body = await getMetricsSnapshot();
        return new Response(body, {
          headers: {
            "content-type": metricsContentType,
          },
        });
      },
    },
  },
});
