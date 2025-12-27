import type { ProjectConfig } from "@alfred/agent/utils/project-detector";
import { buildTools } from "@alfred/agent/v6";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type/plan";
import type { UIMessage } from "@alfred/type/stream";
import type { LanguageModel, Tool } from "ai";
import { AISDKAdapter, type AiAdapter } from "../adapters/ai";
import type { ExecutionContext } from "../context";
import { runOrchestrator } from "../orchestrator";
import type { RuntimeInput } from "../types";

export type ActResult = {
  escalated: boolean;
  reason?: string;
};

type ActPhaseDeps = {
  createAiAdapter?: (runId: string) => AiAdapter;
  buildToolset?: () => Record<string, Tool>;
  runOrchestratorFn?: typeof runOrchestrator;
};

const ACT_SYSTEM_PROMPT = [
  "You are Alfred's execution coordinator.",
  "Follow the approved plan, calling tools only when necessary.",
  "Every tool call must advance the requirement toward completion (no no-op commands).",
  "Summarize outcomes, risks, and follow-ups before finishing.",
].join("\n");

function buildActMessages(
  runId: string,
  input: RuntimeInput,
  context?: ExecutionContext | null,
  planSummary?: string | null
): UIMessage[] {
  const sections: string[] = [
    `Requirement:\n${input.requirement}`,
    `Auto Level: ${input.auto}`,
  ];

  if (planSummary) {
    sections.push(`Plan Summary:\n${planSummary}`);
  }

  if (context?.bundle?.files?.length) {
    const fileLines = context.bundle.files
      .slice(0, 5)
      .map((file) => `- ${file.path}:${file.startLine}-${file.endLine}`)
      .join("\n");
    sections.push(`Focus Files:\n${fileLines}`);
  }

  const text = sections.join("\n\n");
  return [
    {
      id: `user-act-${runId}-${Date.now().toString(36)}`,
      role: "user",
      parts: [{ type: "text", text }],
    },
  ];
}

function attachAuthzToTools(
  tools: Record<string, Tool>,
  authz?: string
): Record<string, Tool> {
  if (!authz) {
    return tools;
  }
  const wrapped: Record<string, Tool> = {};
  for (const [name, definition] of Object.entries(tools)) {
    if (!definition.execute) {
      wrapped[name] = definition;
      continue;
    }
    const originalExecute = definition.execute.bind(definition);
    wrapped[name] = {
      ...definition,
      async execute(input: unknown, options?: unknown) {
        const enriched =
          input && typeof input === "object" && !Array.isArray(input)
            ? { ...(input as Record<string, unknown>), authz }
            : input;
        return originalExecute(enriched, options as any);
      },
    } as Tool;
  }
  return wrapped;
}

export async function* executeActPhase(
  input: RuntimeInput,
  runId: string,
  signal: AbortSignal,
  model: LanguageModel,
  history?: WorkflowEvent[],
  projectConfig?: ProjectConfig | null,
  authz?: string,
  cachedContext?: ExecutionContext | null,
  planSummary?: string | null,
  userId?: string,
  deps?: ActPhaseDeps
): AsyncGenerator<WorkflowEvent, ActResult, void> {
  yield { _: "notice", message: "execution_started" } as WorkflowEvent;

  if (signal.aborted) {
    throw new DOMException("Phase aborted", "AbortError");
  }

  const createAiAdapter =
    deps?.createAiAdapter ?? ((id: string) => new AISDKAdapter({ runId: id }));
  const buildToolset = deps?.buildToolset ?? buildTools;
  const orchestratorRunner = deps?.runOrchestratorFn ?? runOrchestrator;

  const disableAgents =
    (process.env.NODE_ENV === "test" &&
      process.env.RUNTIME_TEST_ORCHESTRATION !== "1") ||
    process.env.RUNTIME_DISABLE_CODEX === "1";

  if (disableAgents) {
    yield { _: "notice", message: "execution_placeholder" } as WorkflowEvent;
    return { escalated: false };
  }

  const mode = input.mode ?? "sequential";

  if (mode === "parallel") {
    yield* orchestratorRunner(
      input,
      runId,
      signal,
      history,
      projectConfig,
      undefined,
      authz,
      cachedContext ?? undefined,
      userId
    );

    return {
      escalated: false,
      reason: undefined,
    };
  }

  const aiAdapter = createAiAdapter(runId);
  const tools = attachAuthzToTools(buildToolset(), authz) as Record<
    string,
    Tool
  >;
  const actMessages = buildActMessages(
    runId,
    input,
    cachedContext,
    planSummary
  );

  try {
    yield {
      _: "notice",
      message: "execution_llm_stream_started",
    } as WorkflowEvent;
    for await (const event of aiAdapter.stream({
      model,
      tools,
      messages: actMessages,
      abortSignal: signal,
      system: ACT_SYSTEM_PROMPT,
      temperature: 0.1,
    })) {
      yield event;
    }
  } catch (error) {
    logger.error("runtime_act_ai_failed", {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });
    yield {
      _: "notice",
      message: "execution_stream_failed",
      error: error instanceof Error ? error.message : String(error),
    } as WorkflowEvent;
    throw error;
  }

  return {
    escalated: false,
    reason: undefined,
  };
}
