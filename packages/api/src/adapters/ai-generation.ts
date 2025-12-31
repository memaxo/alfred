import type { AIAdapter } from "@alfred/type/ai-adapter";
import type {
  GenerateObjectResult,
  GenerateTextResult,
  ModelMessage,
  ToolSet,
} from "ai";
import { generateObject, generateText } from "ai";
import type { z } from "zod";

export class DefaultAIAdapter implements AIAdapter {
  async generateText(params: {
    messages: ModelMessage[];
    system?: string;
    tools?: ToolSet;
  }): Promise<GenerateTextResult<ToolSet, never>> {
    const { getAssistantAgentDefaults } = await import("@alfred/agent/agents");
    const defaults = getAssistantAgentDefaults();
    return generateText({
      model: defaults.model,
      messages: params.messages,
      system: params.system,
      tools: params.tools,
    });
  }

  async generateObject<T>(params: {
    messages: ModelMessage[];
    system?: string;
    schema: z.ZodType<T>;
    prompt?: string;
  }): Promise<GenerateObjectResult<T>> {
    const { getAssistantAgentDefaults } = await import("@alfred/agent/agents");
    const defaults = getAssistantAgentDefaults();
    // prompt and messages are mutually exclusive in AI SDK v6
    const baseParams = {
      model: defaults.model,
      schema: params.schema,
    } as const;
    if (params.prompt) {
      return generateObject({
        ...baseParams,
        prompt: params.prompt,
      });
    }
    return generateObject({
      ...baseParams,
      messages: params.messages ?? [],
      system: params.system,
    });
  }
}
