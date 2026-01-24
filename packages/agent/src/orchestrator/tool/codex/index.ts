import path from "node:path";

import {
  DEFAULT_ALLOW_PREFIXES,
  isWithinBase,
} from "../../../security/filesystem.js";
import { withPolicyApproval, type AITool } from "../approval.js";
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

export {
  CodexError,
  type CodexErrorCode,
  type CodexErrorStage,
} from "./error.js";
export {
  formatArtifactReasoning,
  processThreadEvent,
} from "./event-processor.js";
export * from "./metrics.js";
export { createCodexSpawn } from "./spawn-process.js";

export const toolCodex = {
  description: "Run the OpenAI Codex CLI in sandboxed, non-interactive mode.",
  execute: async ({ input, writer, signal }: CodexExecuteArgs) => {
    await enforcePolicy(input);
    return executeWithCodex({ input, writer, signal });
  },
  inputSchema: codexInputSchema,
  name: "codex",
  outputSchema: toolOutputSchema,
};

const aiToolCodexBase = {
  description: toolCodex.description,
  execute: async (input: CodexToolInput) => toolCodex.execute({ input }),
  inputSchema: toolCodex.inputSchema,
  name: toolCodex.name,
  parameters: toolCodex.inputSchema,
};

export const aiToolCodex: AITool<CodexToolInput, any> = withPolicyApproval(
  aiToolCodexBase,
  (input) => ({
    action: "droid.exec",
    authz: input.authz,
    context: {
      auto: input.auto,
    },
    resource: {
      kind: "repo",
      id: input.cw ? path.resolve(input.cw) : "cwd",
    },
    scopes: ["droid.exec"],
  })
);

export type ToolCodex = typeof toolCodex;

export const __internals = {
  DEFAULT_ALLOW_PREFIXES,
  buildTurnOptions,
  isWithinBase,
  mapAutoToCodex,
  pickEnvCodex,
  resolveExecutable,
  validateOutputSchema,
};
