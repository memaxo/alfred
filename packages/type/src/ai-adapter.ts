import type {
  GenerateObjectResult,
  GenerateTextResult,
  ModelMessage,
} from "ai";
import type { z } from "zod";

export type AIAdapter = {
  generateText(params: {
    messages: ModelMessage[];
    system?: string;
    tools?: Record<string, any>;
  }): Promise<GenerateTextResult<Record<string, any>, never>>;

  generateObject<T>(params: {
    messages: ModelMessage[];
    system?: string;
    schema: z.ZodType<T, any, any>;
    prompt?: string;
  }): Promise<GenerateObjectResult<T>>;
};
