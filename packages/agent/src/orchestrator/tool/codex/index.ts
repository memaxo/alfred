import path from "node:path";
import { withPolicyApproval } from "../approval.js";
import {
  codexInputSchema,
  type CodexToolInput,
  toolOutputSchema,
} from "./definition.js";
import { executeWithSdk } from "./exec.js";
import {
  enforcePolicy,
  mapAutoToCodex,
  pickEnvCodex,
  resolveExecutable,
} from "./policy.js";
import { DEFAULT_ALLOW_PREFIXES, isWithinBase } from "../../../security/filesystem.js";

export type {
  AlfredCodexEvent,
  CodexExecuteArgs,
  CodexToolInput,
  CodexArtifactSummary,
  CodexBackend,
  CodexErrorStage,
  SandboxConfig,
  ToolWriter,
} from "./definition.js";

export { codexInputSchema, toolOutputSchema } from "./definition.js";

export const toolCodex = {
  name: "codex",
  description: "Run the OpenAI Codex CLI in sandboxed, non-interactive mode.",
  inputSchema: codexInputSchema,
  outputSchema: toolOutputSchema,
  execute: async ({
    input,
    writer,
  }: {
    input: CodexToolInput;
    writer?: { write: (chunk: unknown) => Promise<void> | void };
  }) => {
    await enforcePolicy(input);
    // Simplify: Always use SDK backend as CLI is legacy
    return executeWithSdk({ input, writer });
  },
};

const aiToolCodexBase = {
  name: toolCodex.name,
  description: toolCodex.description,
  parameters: toolCodex.inputSchema,
  inputSchema: toolCodex.inputSchema,
  execute: async (input: CodexToolInput) => {
    return toolCodex.execute({ input });
  },
};

export const aiToolCodex = withPolicyApproval(aiToolCodexBase, (input) => {
  return {
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
  };
});

export type ToolCodex = typeof toolCodex;

export const __internals = {
  DEFAULT_ALLOW_PREFIXES,
  isWithinBase,
  pickEnvCodex,
  resolveExecutable,
  mapAutoToCodex,
};
