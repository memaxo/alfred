import { getModelId, getOpenAI } from "./v6";

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
  name: "@alfred/agent",
  version: "0.1.0",
  description: "Agent orchestration and tool execution",
  healthCheck: async () => {
    try {
      const start = performance.now();
      getOpenAI(); // Call to verify it's available
      const modelId = getModelId();

      // Basic availability check
      const available = !!modelId;
      const latency = performance.now() - start;

      return {
        status: available ? "healthy" : "degraded",
        message: available
          ? `Agent model available: ${modelId}`
          : "Agent model not configured",
        latencyMs: latency,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: `Agent health check failed: ${(error as Error).message}`,
      };
    }
  },
  dependencies: ["@alfred/db"],
};
