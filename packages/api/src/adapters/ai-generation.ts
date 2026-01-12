import type { AIAdapter } from "@alfred/type/ai-adapter";
import type { ModelRole } from "@alfred/type/model";
import type {
  GenerateObjectResult,
  GenerateTextResult,
  ModelMessage,
  ToolSet,
} from "ai";
import { generateObject, generateText } from "ai";
import type { z } from "zod";

export type DefaultAIAdapterOpts = {
  userId?: string;
  projectId?: string;
  role?: ModelRole;
};

export class DefaultAIAdapter implements AIAdapter {
  private readonly userId?: string;
  private readonly projectId?: string;
  private readonly role: ModelRole;

  constructor(opts: DefaultAIAdapterOpts = {}) {
    this.userId = opts.userId;
    this.projectId = opts.projectId;
    this.role = opts.role ?? "chat";
  }

  private async resolveModel() {
    if (!this.userId) {
      const { getAssistantAgentDefaults } = await import(
        "@alfred/agent/agents"
      );
      const defaults = getAssistantAgentDefaults();
      return defaults.model;
    }

    const { getModelForRole } = await import("@alfred/agent/selector");
    const selection = this.projectId
      ? await getModelForRole(this.role, {
          userId: this.userId,
          projectId: this.projectId,
        })
      : await getModelForRole(this.role, { userId: this.userId });
    return selection.model;
  }

  async generateText(params: {
    messages: ModelMessage[];
    system?: string;
    tools?: ToolSet;
  }): Promise<GenerateTextResult<ToolSet, never>> {
    const model = await this.resolveModel();
    const telemetry =
      process.env.AI_TELEMETRY === "1"
        ? {
            experimental_telemetry: {
              isEnabled: true,
              functionId: `api.${this.role}.generateText`,
              recordInputs: false,
              recordOutputs: false,
            },
          }
        : {};
    return generateText({
      model,
      messages: params.messages,
      system: params.system,
      tools: params.tools,
      ...telemetry,
    });
  }

  async generateObject<T>(params: {
    messages: ModelMessage[];
    system?: string;
    schema: z.ZodType<T>;
    prompt?: string;
  }): Promise<GenerateObjectResult<T>> {
    const model = await this.resolveModel();
    const telemetry =
      process.env.AI_TELEMETRY === "1"
        ? {
            experimental_telemetry: {
              isEnabled: true,
              functionId: `api.${this.role}.generateObject`,
              recordInputs: false,
              recordOutputs: false,
            },
          }
        : {};
    // prompt and messages are mutually exclusive in AI SDK v6
    const baseParams = {
      model,
      schema: params.schema,
      ...telemetry,
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
