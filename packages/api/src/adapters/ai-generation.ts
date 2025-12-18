import { getAssistantAgentDefaults } from "@alfred/agent";
import type { AIAdapter } from "@alfred/type/ai-adapter";
import type {
  GenerateObjectResult,
  GenerateTextResult,
  ModelMessage,
} from "ai";
import { generateObject, generateText } from "ai";
import type { z } from "zod";

export class DefaultAIAdapter implements AIAdapter {
  async generateText(params: {
    messages: ModelMessage[];
    system?: string;
    tools?: Record<string, any>;
  }): Promise<GenerateTextResult<Record<string, any>, never>> {
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
    schema: z.ZodType<T, any, any>;
    prompt?: string;
  }): Promise<GenerateObjectResult<T>> {
    const defaults = getAssistantAgentDefaults();
    // @ts-expect-error - AI SDK types are strict about prompt vs messages
    return generateObject({
      model: defaults.model,
      messages: params.messages,
      system: params.system,
      schema: params.schema,
      prompt: params.prompt,
    });
  }
}
