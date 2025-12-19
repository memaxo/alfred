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
      model: defaults.model as any,
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
    // prompt and messages are mutually exclusive in AI SDK v6
    const callParams: any = {
      model: defaults.model as any,
      schema: params.schema,
    };
    if (params.prompt) {
      callParams.prompt = params.prompt;
    } else {
      callParams.messages = params.messages;
      if (params.system) {
        callParams.system = params.system;
      }
    }
    return generateObject(callParams);
  }
}
