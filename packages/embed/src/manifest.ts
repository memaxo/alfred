import { z } from "zod";
import { EMBEDDING_DIM, getHealth } from "./index";

// Inline manifest types to avoid tsconfig rootDir issues
type HealthStatus = {
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
};

type CommandDef = {
  name: string;
  description: string;
  args?: z.ZodType<unknown>;
  handler: (args: unknown) => Promise<void>;
  category?: string;
};

type CliManifest = {
  name: string;
  version: string;
  description: string;
  commands?: CommandDef[];
  healthCheck?: () => Promise<HealthStatus>;
  dependencies?: string[];
};

// Embedding commands
const downloadCommand = {
  name: "download",
  description: "Download embedding model weights",
  args: z.object({
    force: z
      .boolean()
      .optional()
      .default(false)
      .describe("Force re-download even if model exists"),
  }),
  handler: async () => {
    // Download logic would go here
    await new Promise((resolve) => setTimeout(resolve, 2000));
  },
};

const benchmarkCommand = {
  name: "benchmark",
  description: "Benchmark embedding generation latency",
  args: z.object({
    iterations: z
      .number()
      .int()
      .positive()
      .optional()
      .default(100)
      .describe("Number of benchmark iterations"),
    batchSize: z
      .number()
      .int()
      .positive()
      .optional()
      .default(1)
      .describe("Number of texts per batch"),
  }),
  handler: async (args: unknown) => {
    const parsed = z
      .object({ iterations: z.number(), batchSize: z.number() })
      .parse(args);
    // Benchmark logic would go here
    let _totalLatency = 0;
    for (let i = 0; i < parsed.iterations; i++) {
      const start = performance.now();
      await new Promise((resolve) =>
        setTimeout(resolve, 10 + Math.random() * 20)
      );
      _totalLatency += performance.now() - start;
    }
  },
};

export const manifest: CliManifest = {
  name: "@alfred/embed",
  version: "0.1.0",
  description: `Embedding generation with KaLM-Embedding-Gemma3-12B (${EMBEDDING_DIM}d)`,
  commands: [downloadCommand, benchmarkCommand],
  healthCheck: async () => {
    try {
      const start = performance.now();
      const health = getHealth();
      const latency = performance.now() - start;

      const allHealthy =
        health.length > 0 &&
        health.every((w) => Boolean(w && "healthy" in w && w.healthy));

      return {
        status: allHealthy
          ? "healthy"
          : health.length === 0
            ? "degraded"
            : "unhealthy",
        message: allHealthy
          ? `Embedding pool healthy (${health.length} workers)`
          : health.length === 0
            ? "Embedding pool not initialized"
            : "Some embedding workers unhealthy",
        latencyMs: latency,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: `Embedding health check failed: ${(error as Error).message}`,
      };
    }
  },
  dependencies: [],
};
