import { z } from "zod";

export const executorKindSchema = z
  .enum(["opencode", "codex", "droid"])
  .describe("Executor backend identifier.");

export const executorExecProfileSchema = z
  .enum(["default", "server"])
  .describe("Executor execution profile (default or long-lived server).");

export const opencodeTransportSchema = z
  .enum(["acp", "http"])
  .describe("OpenCode transport: ACP stdio or OpenCode HTTP server.");

const executorConfigBaseSchema = z.object({
  kind: executorKindSchema,
  v: z
    .number()
    .int()
    .min(1)
    .max(100)
    .describe("Schema version for persisted executor config payloads."),
});

export const opencodeHttpConfigWriteSchema = z.object({
  baseUrl: z
    .string()
    .url()
    .describe("OpenCode HTTP server base URL for external-server mode."),
  username: z
    .string()
    .min(1)
    .optional()
    .describe("OpenCode HTTP basic auth username (if required)."),
  password: z
    .string()
    .min(1)
    .optional()
    .describe("OpenCode HTTP basic auth password (if required)."),
});

export const opencodeHttpConfigPublicSchema = z.object({
  baseUrl: z
    .string()
    .url()
    .describe("OpenCode HTTP server base URL for external-server mode."),
  username: z
    .string()
    .min(1)
    .optional()
    .describe("OpenCode HTTP basic auth username (if required)."),
  passwordSet: z
    .boolean()
    .describe("Whether an HTTP password is stored (never returns the secret)."),
});

export const opencodeAcpConfigSchema = z.object({
  cmd: z
    .string()
    .min(1)
    .optional()
    .describe("Optional ACP command override (defaults to opencode)."),
  args: z
    .array(z.string().min(1))
    .optional()
    .describe("Optional ACP args override."),
});

export const opencodeConfigWriteSchema = executorConfigBaseSchema
  .extend({
    kind: z.literal("opencode"),
    transport: opencodeTransportSchema.describe(
      "Preferred OpenCode transport."
    ),
    defaultExecProfile: executorExecProfileSchema
      .optional()
      .describe("Default exec profile preference for OpenCode."),
    http: opencodeHttpConfigWriteSchema.optional(),
    acp: opencodeAcpConfigSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.transport === "http") {
      if (!value.http?.baseUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "opencode_http_baseurl_required",
          path: ["http", "baseUrl"],
        });
      }
    }
  });

export const opencodeConfigPublicSchema = executorConfigBaseSchema
  .extend({
    kind: z.literal("opencode"),
    transport: opencodeTransportSchema,
    defaultExecProfile: executorExecProfileSchema.optional(),
    http: opencodeHttpConfigPublicSchema.optional(),
    acp: opencodeAcpConfigSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.transport === "http") {
      if (!value.http?.baseUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "opencode_http_baseurl_required",
          path: ["http", "baseUrl"],
        });
      }
    }
  });

export const codexConfigSchema = executorConfigBaseSchema.extend({
  kind: z.literal("codex"),
  defaultExecProfile: executorExecProfileSchema
    .optional()
    .describe("Default exec profile preference for Codex."),
  profile: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe("Optional Codex profile hint (Codex CLI specific)."),
  timeoutSec: z
    .number()
    .int()
    .min(1)
    .max(60 * 60)
    .optional()
    .describe("Optional default timeout for Codex execution."),
});

export const droidConfigSchema = executorConfigBaseSchema.extend({
  kind: z.literal("droid"),
  command: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe("Optional droid binary/command override."),
  args: z
    .array(z.string().min(1))
    .optional()
    .describe("Optional default args for droid execution."),
  timeoutSec: z
    .number()
    .int()
    .min(1)
    .max(60 * 60)
    .optional()
    .describe("Optional default timeout for droid execution."),
});

export const executorConfigWriteSchema = z.discriminatedUnion("kind", [
  opencodeConfigWriteSchema,
  codexConfigSchema,
  droidConfigSchema,
]);

export const executorConfigPublicSchema = z.discriminatedUnion("kind", [
  opencodeConfigPublicSchema,
  codexConfigSchema,
  droidConfigSchema,
]);

export const executorStatusSchema = z.object({
  kind: executorKindSchema,
  supports: z.object({
    execProfiles: z
      .array(executorExecProfileSchema)
      .describe("Exec profiles supported by the executor."),
    transports: z
      .array(opencodeTransportSchema)
      .optional()
      .describe("Transports supported (OpenCode only)."),
  }),
  containerContext: z
    .object({
      present: z
        .boolean()
        .describe(
          "Whether a run-scoped AgentFS container context is addressable."
        ),
      expectedName: z
        .string()
        .min(1)
        .optional()
        .describe("Best-effort expected container name for this run."),
      expectedCw: z
        .string()
        .min(1)
        .optional()
        .describe("Best-effort expected container workdir for this run."),
    })
    .describe("Container routing hints for server-profile executors."),
  config: z.object({
    exists: z.boolean().describe("Whether config is present in AgentFS KV."),
    valid: z
      .boolean()
      .describe("Whether stored config parses and passes structural checks."),
    issues: z
      .array(z.string().min(1))
      .optional()
      .describe("Optional validation issue codes (best-effort)."),
  }),
});

export const executorHealthSchema = z.object({
  kind: executorKindSchema,
  ok: z.boolean().describe("Whether the executor backend appears healthy."),
  checkedAt: z
    .string()
    .datetime()
    .describe("ISO timestamp for when the health check ran."),
  details: z
    .string()
    .min(1)
    .optional()
    .describe("Human-readable detail string (non-secret)."),
});
