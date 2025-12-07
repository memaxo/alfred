import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/metrics")({
  // @ts-expect-error - TanStack Start server handlers
  server: {
    handlers: {
      GET: async () => {
        const metricsPkg = "@alfred/api/metrics";
        const { getMetricsSnapshot, metricsContentType } = await import(
          metricsPkg
        );

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
