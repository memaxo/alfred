import type {
  FlexibleSchema,
  GenerateObjectResult,
  GenerateTextResult,
  ModelMessage,
  ToolSet,
} from "ai";

export interface AIAdapter {
  generateText(params: {
    messages: ModelMessage[];
    system?: string;
    tools?: ToolSet;
  }): Promise<GenerateTextResult<ToolSet, never>>;

  generateObject(params: {
    messages: ModelMessage[];
    system?: string;
    schema: FlexibleSchema<unknown>;
    prompt?: string;
  }): Promise<GenerateObjectResult<unknown>>;
}
