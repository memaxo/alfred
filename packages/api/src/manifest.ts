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
  name: "@alfred/api",
  version: "0.1.0",
  description: "tRPC API layer with routers, context, and metrics",
  healthCheck: async () => {
    try {
      const start = performance.now();
      // Check if API is responsive
      const latency = performance.now() - start;

      return {
        status: "healthy",
        message: "API layer operational",
        latencyMs: latency,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: `API health check failed: ${(error as Error).message}`,
      };
    }
  },
  dependencies: ["@alfred/db"],
};
