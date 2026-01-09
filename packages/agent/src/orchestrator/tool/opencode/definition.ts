import { z } from "zod";

export const opencodeInputSchema = z.object({
  action: z
    .literal("exec")
    .describe("Operation to perform (OpenCode execution)."),
  prompt: z.string().min(1).describe("Full prompt to send to the agent."),
  auto: z
    .enum(["read", "low", "medium", "high"])
    .default("read")
    .describe("Autonomy band for the run."),
  cw: z
    .string()
    .optional()
    .describe("Working directory on the host (or workspace root)."),
  model: z
    .string()
    .optional()
    .describe("Optional model hint passed to the agent environment."),
  authz: z
    .string()
    .optional()
    .describe("Bearer token for tool policy enforcement."),
  timeoutSec: z
    .number()
    .int()
    .min(1)
    .max(60 * 60)
    .optional()
    .describe("Hard timeout for the OpenCode subprocess."),
  env: z
    .record(z.string(), z.string())
    .optional()
    .describe("Extra environment variables (allowlisted in policy)."),
  sessionId: z
    .string()
    .min(1)
    .max(255)
    .optional()
    .describe("Optional session identifier (passed through to ACP)."),
  /** Docker container name to run the ACP agent inside (AgentFSWorkspace container) */
  containerName: z
    .string()
    .min(1)
    .max(255)
    .optional()
    .describe("AgentFS container name/id to run inside via docker exec."),
  /** Workdir inside the container (must be under /workspace) */
  containerCw: z
    .string()
    .min(1)
    .max(1024)
    .optional()
    .describe("Working directory inside the container (posix path)."),
  /** ACP stdio command (defaults to OPENCODE_ACP_CMD or 'opencode') */
  cmd: z
    .string()
    .min(1)
    .optional()
    .describe("Binary/command to launch an ACP-speaking OpenCode agent."),
  /** ACP stdio arguments (defaults to OPENCODE_ACP_ARGS) */
  args: z
    .array(z.string().min(1))
    .optional()
    .describe("Arguments to pass when launching the ACP agent."),
});

export type OpenCodeToolInput = z.infer<typeof opencodeInputSchema>;

export const opencodeOutputSchema = z.object({
  result: z.string().describe("Final text result from the agent."),
  artifacts: z
    .array(
      z.object({
        path: z.string(),
        kind: z.string(),
      })
    )
    .optional()
    .describe("Optional artifact summaries emitted by the agent."),
  stopReason: z
    .string()
    .optional()
    .describe("ACP stop reason if provided by the backend."),
});

export type OpenCodeToolOutput = z.infer<typeof opencodeOutputSchema>;

