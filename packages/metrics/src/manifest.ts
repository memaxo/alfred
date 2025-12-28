import { register } from "prom-client";

// Inline manifest types to avoid tsconfig rootDir issues
type HealthStatus = {
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
};

type CliManifest = {
  name: string;
  version: string;
  description: string;
  healthCheck?: () => Promise<HealthStatus>;
  dependencies?: string[];
};

export const manifest: CliManifest = {
  name: "@alfred/metrics",
  version: "0.1.0",
  description: "Prometheus metrics collection and instrumentation",
  healthCheck: async () => {
    try {
      const start = performance.now();
      const metrics = await register.metrics();
      const latency = performance.now() - start;

      return {
        status: "healthy",
        message: `Prometheus registry operational (${metrics.split("\n").length} lines)`,
        latencyMs: latency,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: `Metrics health check failed: ${(error as Error).message}`,
      };
    }
  },
  dependencies: [],
};
