import type {
  GenerateObjectResult,
  GenerateTextResult,
  ModelMessage,
  ToolSet,
} from "ai";
import type { z } from "zod";

export type AIAdapter = {
  generateText(params: {
    messages: ModelMessage[];
    system?: string;
    tools?: ToolSet;
  }): Promise<GenerateTextResult<ToolSet, never>>;

  generateObject<T>(params: {
    messages: ModelMessage[];
    system?: string;
    schema: z.ZodType<T>;
    prompt?: string;
  }): Promise<GenerateObjectResult<T>>;
};
