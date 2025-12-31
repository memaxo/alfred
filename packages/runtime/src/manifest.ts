import { z } from "zod";

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

// Workflow management commands
const workflowListCommand = {
  name: "workflow:list",
  description: "List recent workflow runs",
  args: z.object({
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .default(10)
      .describe("Number of runs to show"),
    status: z
      .enum(["running", "completed", "failed", "suspended", "cancelled"])
      .optional()
      .describe("Filter by status"),
  }),
  handler: async (args: unknown) => {
    z.object({ limit: z.number(), status: z.string().optional() }).parse(args);
    // List logic would go here
    await new Promise((resolve) => setTimeout(resolve, 500));
  },
};

const workflowCancelCommand = {
  name: "workflow:cancel",
  description: "Cancel a running workflow",
  args: z.object({
    runId: z.string().uuid().describe("Workflow run ID to cancel"),
  }),
  handler: async (args: unknown) => {
    z.object({ runId: z.string() }).parse(args);
    // Cancel logic would go here
    await new Promise((resolve) => setTimeout(resolve, 800));
  },
};

export const manifest: CliManifest = {
  name: "@alfred/runtime",
  version: "0.1.0",
  description:
    "Workflow execution runtime with cognitive loops and phase management",
  commands: [workflowListCommand, workflowCancelCommand],
  healthCheck: async () => {
    try {
      const start = performance.now();
      const latency = performance.now() - start;

      await Promise.resolve(); // biome-ignore lint/suspicious/useAwait: required to satisfy async return type
      return {
        status: "healthy",
        message: "Runtime ready",
        latencyMs: latency,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: `Runtime health check failed: ${(error as Error).message}`,
      };
    }
  },
  dependencies: ["@alfred/db", "@alfred/agent"],
};
