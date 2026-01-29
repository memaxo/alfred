import { stepCountIs } from "ai";

import { generateText, persistResult } from "../ai/generate";
import { prepareModelMessagesForGenerate } from "../ai/messages";
import { sanitizeResult } from "../utils/generate";
import { ensureHooksRuntime } from "../workflow/hooks";

function coerceUsage(value: unknown): {
  inputTokens: number;
  outputTokens: number;
} {
  if (!value || typeof value !== "object") {
    return { inputTokens: 0, outputTokens: 0 };
  }
  const u = value as Record<string, unknown>;
  const inputTokens =
    typeof u.inputTokens === "number"
      ? u.inputTokens
      : (typeof u.promptTokens === "number"
        ? u.promptTokens
        : 0);
  const outputTokens =
    typeof u.outputTokens === "number"
      ? u.outputTokens
      : (typeof u.completionTokens === "number"
        ? u.completionTokens
        : 0);
  return { inputTokens, outputTokens };
}

interface OrchestratorGenerateInput {
  projectId?: string;
  userId: string;
  messages: unknown[];
  toolChoice?: "auto" | "none" | "required";
  maxSteps?: number;
}

export interface OrchestratorGenerateResult {
  text: string;
  toolCalls: unknown[];
  toolResults: unknown[];
  usage: { inputTokens: number; outputTokens: number };
  warnings: unknown[];
  finishReason: string;
  replayId?: string;
}

/**
 * Orchestrator domain service
 *
 * Extracts business logic from orchestrator router to keep routers thin.
 * Handles orchestrator text generation with model selection and persistence.
 */
export async function generateOrchestratorText(
  input: OrchestratorGenerateInput
): Promise<OrchestratorGenerateResult> {
  const { getOrchestratorAgentDefaults } = await import("@alfred/agent/agents");
  const { getModelForRole } = await import("@alfred/agent/selector");
  const defaults = getOrchestratorAgentDefaults();
  const selection = input.projectId
    ? await getModelForRole("orchestrator", {
        userId: input.userId,
        projectId: input.projectId,
      })
    : await getModelForRole("orchestrator", {
        userId: input.userId,
      });

  const system =
    typeof defaults.instructions === "string"
      ? defaults.instructions
      : JSON.stringify(defaults.instructions);

  const modelMessages = await prepareModelMessagesForGenerate({
    rawMessages: input.messages,
    tools: defaults.tools,
    source: "orchestrator",
    model: selection.modelKey,
    system,
  });

  const stopWhen =
    typeof input.maxSteps === "number"
      ? stepCountIs(input.maxSteps)
      : defaults.stopWhen;

  const telemetry =
    process.env.AI_TELEMETRY === "1"
      ? {
          experimental_telemetry: {
            isEnabled: true,
            functionId: "api.orchestrator.generate",
            recordInputs: false,
            recordOutputs: false,
          },
        }
      : {};

  const hooks = await ensureHooksRuntime(null, {
    sessionId: input.userId,
    signal: new AbortController().signal,
    workspace: process.cwd(),
    workflowId: input.projectId,
  });

  const result = await generateText({
    ...defaults,
    model: selection.model,
    messages: modelMessages,
    toolChoice: input.toolChoice,
    stopWhen,
    experimental_context: { hooks },
    ...telemetry,
  });

  const output = sanitizeResult(result);
  const usage = coerceUsage(output.usage);
  const replayId = await persistResult({
    userId: input.userId,
    projectId: input.projectId,
    kind: "orchestrator",
    input: {
      messages: input.messages,
      toolChoice: input.toolChoice,
      maxSteps: input.maxSteps,
    },
    result: output,
  });

  return {
    text: output.text,
    toolCalls: output.toolCalls,
    toolResults: output.toolResults,
    usage,
    warnings: output.warnings,
    finishReason: output.finishReason ?? "stop",
    replayId: replayId ?? undefined,
  };
}
