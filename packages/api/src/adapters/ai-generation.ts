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
    // @ts-expect-error - AI SDK tool definitions use complex tool types that don't simplify well
    tools?: Record<string, unknown>;
  }): Promise<GenerateTextResult<Record<string, unknown>, never>> {
    const { getAssistantAgentDefaults } = await import("@alfred/agent/agents");
    const defaults = getAssistantAgentDefaults();
    return generateText({
      // @ts-expect-error - Default model type needs manual assertion due to dynamic import
      model: defaults.model as unknown,
      messages: params.messages,
      system: params.system,
      tools: params.tools as { [key: string]: unknown },
    });
  }

  async generateObject<T>(params: {
    messages: ModelMessage[];
    system?: string;
    // @ts-expect-error - Zod schema output/input types are not relevant for generateObject
    schema: z.ZodType<T, unknown, unknown>;
    prompt?: string;
  }): Promise<GenerateObjectResult<T>> {
    const { getAssistantAgentDefaults } = await import("@alfred/agent/agents");
    const defaults = getAssistantAgentDefaults();
    // prompt and messages are mutually exclusive in AI SDK v6
    // @ts-expect-error - generateObject params have complex conditional types
    const callParams: Record<string, unknown> = {
      model: defaults.model as unknown,
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
    return generateObject(
      callParams as {
        model: unknown;
        schema: z.ZodType<T, unknown, unknown>;
        messages?: ModelMessage[];
        system?: string;
        prompt?: string;
      }
    );
  }
}
