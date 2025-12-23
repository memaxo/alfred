import path from "node:path";
import {
  DEFAULT_ALLOW_PREFIXES,
  isWithinBase,
} from "../../../security/filesystem.js";
import { withPolicyApproval } from "../approval.js";
import {
  type CodexExecuteArgs,
  type CodexToolInput,
  codexInputSchema,
  toolOutputSchema,
  validateOutputSchema,
} from "./definition.js";
import { buildTurnOptions, executeWithCodex } from "./exec.js";
import {
  enforcePolicy,
  mapAutoToCodex,
  pickEnvCodex,
  resolveExecutable,
} from "./policy.js";

export type {
  AlfredCodexEvent,
  CodexArtifactSummary,
  CodexExecuteArgs,
  CodexToolInput,
  SandboxConfig,
} from "./definition.js";

export { codexInputSchema, toolOutputSchema } from "./definition.js";

export { CodexError, type CodexErrorStage, type CodexErrorCode } from "./error.js";
export { createCodexSpawn } from "./spawn-process.js";
export { processThreadEvent, formatArtifactReasoning } from "./event-processor.js";

export const toolCodex = {
  name: "codex",
  description: "Run the OpenAI Codex CLI in sandboxed, non-interactive mode.",
  inputSchema: codexInputSchema,
  outputSchema: toolOutputSchema,
  execute: async ({ input, writer, signal }: CodexExecuteArgs) => {
    await enforcePolicy(input);
    return executeWithCodex({ input, writer, signal });
  },
};

const aiToolCodexBase = {
  name: toolCodex.name,
  description: toolCodex.description,
  parameters: toolCodex.inputSchema,
  inputSchema: toolCodex.inputSchema,
  execute: async (input: CodexToolInput) => toolCodex.execute({ input }),
};

export const aiToolCodex = withPolicyApproval(aiToolCodexBase, (input) => ({
  action: "droid.exec",
  resource: {
    kind: "repo",
    id: input.cw ? path.resolve(input.cw) : "cwd",
  },
  scopes: ["droid.exec"],
  authz: input.authz,
  context: {
    auto: input.auto,
  },
}));

export type ToolCodex = typeof toolCodex;

export const __internals = {
  DEFAULT_ALLOW_PREFIXES,
  isWithinBase,
  pickEnvCodex,
  resolveExecutable,
  mapAutoToCodex,
  validateOutputSchema,
  buildTurnOptions,
};
