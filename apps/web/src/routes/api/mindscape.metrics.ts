import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  hits: z.number().int().nonnegative().optional(),
  misses: z.number().int().nonnegative().optional(),
  evictions: z.number().int().nonnegative().optional(),
});

export const Route = createFileRoute("/api/mindscape/metrics")({
  // @ts-expect-error - TanStack Start server handlers
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let parsed: z.infer<typeof payloadSchema>;
        try {
          const body = await request.json();
          const result = payloadSchema.safeParse(body);
          if (!result.success) {
            return new Response(JSON.stringify({ error: "Invalid payload" }), {
              status: 422,
              headers: { "content-type": "application/json" },
            });
          }
          parsed = result.data;
        } catch {
          return new Response(
            JSON.stringify({ error: "Malformed JSON body" }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            }
          );
        }

        const { hits = 0, misses = 0, evictions = 0 } = parsed;
        const total = hits + misses + evictions;
        if (total === 0) {
          return new Response(null, { status: 204 });
        }

        const metricsPkg = "@alfred/api/metrics";
        const { mindscapeRagCacheEventsTotal } = await import(metricsPkg);

        if (hits > 0) {
          mindscapeRagCacheEventsTotal.labels("hit").inc(hits);
        }
        if (misses > 0) {
          mindscapeRagCacheEventsTotal.labels("miss").inc(misses);
        }
        if (evictions > 0) {
          mindscapeRagCacheEventsTotal.labels("eviction").inc(evictions);
        }

        return new Response(null, { status: 204 });
      },
    },
  },
});
