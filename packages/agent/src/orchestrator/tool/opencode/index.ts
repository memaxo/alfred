import type { ToolExecuteContext } from "../shared/context.js";
import {
  type OpenCodeToolInput,
  opencodeInputSchema,
  opencodeOutputSchema,
} from "./definition.js";
import { executeWithOpenCode } from "./exec.js";
import { enforcePolicy } from "./policy.js";

export type { OpenCodeToolInput } from "./definition.js";

export const toolOpenCode = {
  name: "opencode",
  description: "Run an ACP-compatible OpenCode agent over stdio.",
  inputSchema: opencodeInputSchema,
  outputSchema: opencodeOutputSchema,
  execute: async ({
    input,
    writer,
    signal,
  }: ToolExecuteContext<OpenCodeToolInput>) => {
    await enforcePolicy(input);
    return executeWithOpenCode({ input, writer, signal });
  },
};

export type ToolOpenCode = typeof toolOpenCode;
