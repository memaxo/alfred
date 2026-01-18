import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/healthz/embed")({
  server: {
    handlers: {
      GET: async () => {
        const embedPkg = "@alfred/embed";

        try {
          const { getHealth, getQueueStats, hasCapacity } = await import(
            /* @vite-ignore */ embedPkg
          );

          const workers = getHealth() as {
            index: number;
            status: "idle" | "busy" | "error" | "terminated";
            lastActive: number;
            uptime: number;
          }[];

          const queueStats = getQueueStats();

          // Calculate summary metrics
          const activeWorkers = workers.filter(
            (w) => w.status === "idle" || w.status === "busy"
          ).length;
          const busyWorkers = workers.filter((w) => w.status === "busy").length;
          const errorWorkers = workers.filter(
            (w) => w.status === "error"
          ).length;

          const status = {
            ok: activeWorkers > 0,
            ts: Date.now(),
            pool: {
              totalWorkers: workers.length,
              activeWorkers,
              busyWorkers,
              errorWorkers,
              workers: workers.map((w) => ({
                index: w.index,
                status: w.status,
                uptimeMs: w.uptime,
              })),
            },
            queue: queueStats
              ? {
                  enabled: true,
                  length: queueStats.queueLength,
                  hasCapacity: hasCapacity(),
                  stats: {
                    totalQueued: queueStats.totalQueued,
                    totalProcessed: queueStats.totalProcessed,
                    totalDropped: queueStats.totalDropped,
                    totalRetries: queueStats.totalRetries,
                    totalBatched: queueStats.totalBatched,
                    avgBatchSize:
                      Math.round(queueStats.avgBatchSize * 100) / 100,
                    avgQueueTimeMs:
                      Math.round(queueStats.avgQueueTimeMs * 100) / 100,
                  },
                }
              : {
                  enabled: false,
                },
          };

          return Response.json(status, {
            status: status.ok ? 200 : 503,
            headers: {
              "Cache-Control": "no-store",
            },
          });
        } catch {
          // Pool not initialized - return minimal status
          return Response.json(
            {
              ok: false,
              ts: Date.now(),
              error: "embed_pool_not_initialized",
              pool: {
                totalWorkers: 0,
                activeWorkers: 0,
                busyWorkers: 0,
                errorWorkers: 0,
                workers: [],
              },
              queue: {
                enabled: false,
              },
            },
            {
              status: 503,
              headers: {
                "Cache-Control": "no-store",
              },
            }
          );
        }
      },
    },
  },
});
