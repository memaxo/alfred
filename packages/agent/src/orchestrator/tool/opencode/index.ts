import { type ToolExecuteContext } from "../shared/context.js";
import {
  type OpenCodeToolInput,
  opencodeInputSchema,
  opencodeOutputSchema,
} from "./definition.js";
import { executeWithOpenCode } from "./exec.js";
import { enforcePolicy } from "./policy.js";

export type { OpenCodeToolInput } from "./definition.js";

export const toolOpenCode = {
  description: "Run an OpenCode agent (ACP stdio or OpenCode HTTP server).",
  execute: async ({
    input,
    writer,
    signal,
  }: ToolExecuteContext<OpenCodeToolInput>) => {
    await enforcePolicy(input);
    if (input.transport === "http") {
      const { executeWithOpenCodeHttp } = await import("./http.js");
      return executeWithOpenCodeHttp({ input, writer, signal });
    }
    return executeWithOpenCode({ input, writer, signal });
  },
  inputSchema: opencodeInputSchema,
  name: "opencode",
  outputSchema: opencodeOutputSchema,
};

export type ToolOpenCode = typeof toolOpenCode;
