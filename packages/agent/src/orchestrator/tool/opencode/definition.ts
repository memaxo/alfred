import { z } from "zod";

const mcpHttpHeaderSchema = z
  .object({
    name: z.string().min(1),
    value: z.string(),
  })
  .passthrough();

const mcpServerHttpSchema = z
  .object({
    headers: z.array(mcpHttpHeaderSchema),
    name: z.string().min(1),
    url: z.string().url(),
  })
  .passthrough();

export const opencodeInputSchema = z.object({
  action: z
    .literal("exec")
    .describe("Operation to perform (OpenCode execution)."),
  transport: z
    .enum(["acp", "http"])
    .default("acp")
    .describe(
      "Transport for OpenCode integration: ACP stdio or OpenCode HTTP."
    ),
  baseUrl: z
    .string()
    .url()
    .optional()
    .describe(
      "OpenCode HTTP server base URL (external-server mode only; container mode ignores this)."
    ),
  username: z
    .string()
    .min(1)
    .optional()
    .describe("OpenCode HTTP basic auth username (external-server mode only)."),
  password: z
    .string()
    .min(1)
    .optional()
    .describe("OpenCode HTTP basic auth password (external-server mode only)."),
  execProfile: z
    .enum(["default", "server"])
    .optional()
    .describe(
      "Execution profile: default spawns per prompt; server reuses a long-lived backend inside AgentFS."
    ),
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
    .describe(
      "Optional ALFRED session identifier (passed through to ACP, or mapped to a server-side session for HTTP)."
    ),
  /** Docker container name to run the ACP agent inside (AgentFSWorkspace container) */
  containerName: z
    .string()
    .min(1)
    .max(255)
    .describe("AgentFS container name/id to run inside via docker exec."),
  /** Workdir inside the container (must be under /workspace) */
  containerCw: z
    .string()
    .min(1)
    .max(1024)
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
  mcpServers: z
    .array(mcpServerHttpSchema)
    .optional()
    .describe("Optional MCP servers to include in the ACP session."),
});

export type OpenCodeToolInput = z.input<typeof opencodeInputSchema>;

export const opencodeOutputSchema = z.object({
  artifacts: z
    .array(
      z.object({
        path: z.string(),
        kind: z.string(),
      })
    )
    .optional()
    .describe("Optional artifact summaries emitted by the agent."),
  result: z.string().describe("Final text result from the agent."),
  stopReason: z
    .string()
    .optional()
    .describe("ACP stop reason if provided by the backend."),
});

export type OpenCodeToolOutput = z.infer<typeof opencodeOutputSchema>;
