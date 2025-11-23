import { z } from "zod";

export const OUTPUT_CAP_BYTES = 5 * 1024 * 1024; // 5 MiB
export const DEFAULT_TIMEOUT_SEC = 30 * 60;
export const MIN_TIMEOUT_SEC = 30;
export const MAX_TIMEOUT_SEC = 2 * 60 * 60;

export const MCP_ENV_ALLOWLIST = new Set([
  "CONTEXT7_API_KEY",
  "CONTEXT7_BASE_URL",
  "GITHUB_PAT",
  "GITHUB_PERSONAL_ACCESS_TOKEN",
  "GITHUB_TOKEN",
  "GITHUB_HOST",
  "GITHUB_TOOLSETS",
  "GITHUB_DYNAMIC_TOOLSETS",
  "GITHUB_READ_ONLY",
  "PLAYWRIGHT_BROWSERS_PATH",
  "PLAYWRIGHT_SERVICE_ACCESS_TOKEN",
  "PLAYWRIGHT_WS_ENDPOINT",
  "PLAYWRIGHT_HEADLESS",
  "MCP_AUTH_TOKEN",
]);

export const codexInputSchema = z.object({
  action: z.literal("exec"),
  prompt: z.string().min(1),
  out: z.enum(["text", "json", "debug"]).default("text"),
  auto: z.enum(["read", "low", "medium", "high"]).default("read"),
  cw: z.string().optional(),
  model: z.string().optional(),
  profile: z.string().optional(),
  authz: z.string().optional(),
  timeoutSec: z
    .number()
    .int()
    .min(MIN_TIMEOUT_SEC)
    .max(MAX_TIMEOUT_SEC)
    .optional(),
  env: z.record(z.string(), z.string()).optional(),
  sessionId: z.string().min(1).max(255).optional(),
  containerId: z.string().optional(), // Phase 11: Docker support
  outputSchema: z.record(z.string(), z.unknown()).optional(),
  context: z
    .object({
      linearIssueId: z.string().optional(),
      linearSessionId: z.string().optional(),
      linearSpace: z.string().optional(),
      linearAuthz: z.string().optional(),
      relevantFiles: z.array(z.string()).optional(),
      confidence: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

export type CodexToolInput = z.infer<typeof codexInputSchema>;

export const toolOutputSchema = z.object({
  result: z.string(),
  artifacts: z
    .array(
      z.object({
        path: z.string(),
        kind: z.string(),
      })
    )
    .optional(),
  reasoning: z
    .array(
      z.object({
        text: z.string(),
        timestamp: z.number(),
      })
    )
    .optional(),
});

export type AlfredCodexEvent =
  | {
      type: "thought";
      content: string;
      timestamp: number;
    }
  | {
      type: "command";
      command: string;
      status: "running" | "completed" | "failed";
    }
  | {
      type: "output";
      content: string;
    }
  | {
      type: "artifact";
      path: string;
      kind: "file" | "image";
    };

export type CodexArtifactSummary = {
  path: string;
  kind: string;
};

export type ToolWriter =
  | { write: (chunk: unknown) => Promise<void> | void }
  | undefined;

export type CodexExecuteArgs = {
  input: CodexToolInput;
  writer?: ToolWriter;
};

export type SandboxConfig = {
  sandbox: "read-only" | "workspace-write";
  approval: "on-request";
};

export type CodexBackend = "cli" | "sdk";

export type CodexErrorStage = "spawn" | "timeout" | "parse" | "runtime";
