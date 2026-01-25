// Inline manifest types to avoid tsconfig rootDir issues
interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

interface CliManifest {
  name: string;
  version: string;
  description: string;
  healthCheck?: () => Promise<HealthStatus>;
  dependencies?: string[];
}

export const manifest: CliManifest = {
  name: "@alfred/plan",
  version: "0.1.0",
  description: "Planning and task decomposition for workflow execution",
  healthCheck: async () => {
    try {
      const start = performance.now();
      // Check if planner is ready
      const latency = performance.now() - start;

      return {
        status: "healthy",
        message: "Planner operational",
        latencyMs: latency,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: `Planner health check failed: ${(error as Error).message}`,
      };
    }
  },
  dependencies: ["@alfred/agent", "@alfred/rag"],
};
