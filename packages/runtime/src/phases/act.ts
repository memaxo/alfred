import type { ProjectConfig } from "@alfred/agent/utils/project-detector";
import { buildTools } from "@alfred/agent/v6";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type/plan";
import type { UIMessage } from "@alfred/type/stream";
import type {
  LanguageModel,
  ModelMessage,
  Tool,
  ToolExecutionOptions,
} from "ai";
import { convertToModelMessages, generateObject } from "ai";
import { AISDKAdapter, type AiAdapter } from "../adapters/ai";
import {
  executeToolGraph,
  type ToolGraph,
  type ToolGraphResult,
  toolGraphSchema,
} from "../chain";
import type { ExecutionContext } from "../context";
import { runOrchestrator } from "../orchestrator";
import type { RuntimeInput } from "../types";

export type ActResult = {
  escalated: boolean;
  reason?: string;
};

type ActPhaseDeps = {
  createAiAdapter?: (runId: string) => AiAdapter;
  buildToolset?: () => Record<string, ToolDef>;
  runOrchestratorFn?: typeof runOrchestrator;
  generateToolGraph?: (options: {
    model: LanguageModel;
    messages: ModelMessage[];
    signal: AbortSignal;
    tools: Record<string, ToolDef>;
  }) => Promise<ToolGraph>;
};

type ToolDef = Tool<unknown, unknown>;

const ACT_SYSTEM_PROMPT = [
  "You are Alfred's execution coordinator.",
  "Follow the approved plan and summarize outcomes and risks.",
  "Every tool call must advance the requirement toward completion (no no-op commands).",
  "Summarize outcomes, risks, and follow-ups before finishing.",
].join("\n");

function buildToolGraphSystemPrompt(tools: Record<string, ToolDef>): string {
  const names = Object.keys(tools).sort();
  const toolLines = names
    .map((name) => {
      const tool = tools[name];
      const description =
        tool && typeof tool.description === "string" ? tool.description : "";
      return description ? `- ${name}: ${description}` : `- ${name}`;
    })
    .join("\n");

  return [
    "You are Alfred's tool execution planner.",
    "Generate a JSON tool graph that can be executed as a DAG.",
    "Only use tools from the provided catalog.",
    "Keep the graph small: max 32 nodes.",
    "Use explicit output passing with $ref objects inside node inputs:",
    `  { "$ref": { "step": "<node-id>", "path": "foo.bar[0].baz" } }`,
    "Dependencies may be expressed via dependsOn or via $ref; the executor will infer dependencies from $ref usage.",
    "Keep retries low and explicit (0-2). Prefer a fallback tool when appropriate.",
    "",
    "Tool Catalog:",
    toolLines,
  ].join("\n");
}

function buildToolGraphMessages(messages: UIMessage[]): ModelMessage[] {
  const stripped = messages.map(({ id: _id, ...rest }) => rest);
  return convertToModelMessages(stripped);
}

function formatToolGraphOutputs(result: ToolGraphResult): string {
  const lines: string[] = [];
  for (const node of Object.values(result.nodes)) {
    const base = `- ${node.id} (${node.toolName}): ${node.status}`;
    if (node.status === "succeeded") {
      lines.push(
        `${base} (attempts=${node.attempts}, fallback=${node.usedFallback})`
      );
      lines.push(`  output: ${safeJson(node.output, 2000)}`);
    } else {
      lines.push(
        `${base} (attempts=${node.attempts}, fallback=${node.usedFallback})`
      );
      lines.push(`  error: ${node.error}`);
    }
  }
  return lines.join("\n");
}

function safeJson(value: unknown, maxLen: number): string {
  let text = "";
  try {
    text = JSON.stringify(value);
  } catch {
    text = String(value);
  }
  if (text.length <= maxLen) {
    return text;
  }
  return `${text.slice(0, maxLen)}…`;
}

function readOptionalIntEnv(key: string): number | undefined {
  const raw = process.env[key];
  if (!raw) {
    return;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return;
  }
  return parsed;
}

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
  tools: Record<string, ToolDef>,
  authz?: string
): Record<string, ToolDef> {
  if (!authz) {
    return tools;
  }
  const wrapped: Record<string, ToolDef> = {};
  for (const [name, definition] of Object.entries(tools)) {
    if (!definition.execute) {
      wrapped[name] = definition;
      continue;
    }
    const originalExecute = definition.execute.bind(definition);
    wrapped[name] = {
      ...definition,
      async execute(input: unknown, options: ToolExecutionOptions) {
        const enriched =
          input && typeof input === "object" && !Array.isArray(input)
            ? { ...(input as Record<string, unknown>), authz }
            : input;
        return originalExecute(enriched, options);
      },
    } as ToolDef;
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
  deps?: ActPhaseDeps,
  projectId?: string
): AsyncGenerator<WorkflowEvent, ActResult, void> {
  yield { _: "notice", message: "execution_started" } as WorkflowEvent;

  if (signal.aborted) {
    throw new DOMException("Phase aborted", "AbortError");
  }

  const createAiAdapter =
    deps?.createAiAdapter ??
    ((id: string) => new AISDKAdapter({ runId: id, userId, projectId }));
  const buildToolset =
    deps?.buildToolset ??
    (buildTools as unknown as () => Record<string, ToolDef>);
  const generateToolGraph =
    deps?.generateToolGraph ??
    (async (options: {
      model: LanguageModel;
      messages: ModelMessage[];
      signal: AbortSignal;
      tools: Record<string, ToolDef>;
    }) => {
      const systemPrompt = buildToolGraphSystemPrompt(options.tools);
      const planned = await generateObject({
        model: options.model,
        schema: toolGraphSchema,
        messages: options.messages,
        system: systemPrompt,
        temperature: 0,
        abortSignal: options.signal,
        maxRetries: 1,
      });
      return toolGraphSchema.parse(planned.object);
    });
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
  const tools = attachAuthzToTools(buildToolset(), authz);
  const actMessages = buildActMessages(
    runId,
    input,
    cachedContext,
    planSummary
  );

  const toolGraphMessages = buildToolGraphMessages(actMessages);

  let toolRunSummaryText = "";
  let toolGraphRunStatus: ToolGraphResult["status"] | undefined;
  try {
    yield {
      _: "notice",
      message: "execution_tool_graph_planning_started",
    } as WorkflowEvent;

    const graph = await generateToolGraph({
      model,
      messages: toolGraphMessages,
      signal,
      tools,
    });

    yield {
      _: "notice",
      message: "execution_tool_graph_execution_started",
    } as WorkflowEvent;

    const graphIterator = executeToolGraph({
      graph,
      tools,
      signal,
      toolCallMessages: toolGraphMessages,
      maxParallel:
        input.toolgraph?.maxParallel ??
        readOptionalIntEnv("RUNTIME_TOOL_GRAPH_MAX_PARALLEL"),
      backoffMs:
        input.toolgraph?.backoffMs ??
        readOptionalIntEnv("RUNTIME_TOOL_GRAPH_BACKOFF_MS"),
    }) as AsyncGenerator<WorkflowEvent, ToolGraphResult, void>;

    const iter = graphIterator[Symbol.asyncIterator]();
    let graphRunResult: ToolGraphResult | undefined;
    while (true) {
      const next = await iter.next();
      if (next.done) {
        graphRunResult = next.value;
        break;
      }
      yield next.value;
    }

    toolRunSummaryText = graphRunResult
      ? formatToolGraphOutputs(graphRunResult)
      : "";
    toolGraphRunStatus = graphRunResult?.status;
  } catch (error) {
    logger.error("runtime_act_tool_graph_failed", {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });
    yield {
      _: "notice",
      message: "execution_tool_graph_failed",
      error: error instanceof Error ? error.message : String(error),
    } as WorkflowEvent;
    throw error;
  }

  if (toolGraphRunStatus === "failed") {
    yield {
      _: "notice",
      message: "execution_tool_graph_execution_failed",
    } as WorkflowEvent;

    return {
      escalated: true,
      reason: "tool_graph_failed",
    };
  }

  try {
    yield {
      _: "notice",
      message: "execution_llm_stream_started",
    } as WorkflowEvent;

    const summaryMessages: UIMessage[] = toolRunSummaryText
      ? [
          ...actMessages,
          {
            id: `user-act-tools-${runId}-${Date.now().toString(36)}`,
            role: "user",
            parts: [
              {
                type: "text",
                text: `Tool execution results:\n\n${toolRunSummaryText}`,
              },
            ],
          },
        ]
      : actMessages;

    for await (const event of aiAdapter.stream({
      model,
      tools: undefined,
      messages: summaryMessages,
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
