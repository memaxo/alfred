import type { CognitiveEffect, CognitiveLoopResult } from "@alfred/runtime";
import type { RuntimeContext } from "@alfred/type/runtime-context";
import type { UIMessage } from "@alfred/type/stream";
import type { VoiceAssistantRaw } from "@alfred/type/voice";

import { type Event, type Outcome, timestamp } from "@alfred/cognitive/state";
import * as conversationRepo from "@alfred/db/repo/conversation";
import * as userRepo from "@alfred/db/repo/user";
import { buildHistoryContext, getOrCreateTracker } from "@alfred/history";
import { logger } from "@alfred/logger";
import {
  adaptForVoice,
  buildPersonaPrompt,
  formatGreeting,
  timeOfDayFromHour,
} from "@alfred/persona";

import { generateText, persistResult } from "../ai/generate";
import { prepareModelMessagesForGenerate } from "../ai/messages";
import { getHonorificPreference } from "../persona/honorific";
import { sanitizeResult } from "../utils/generate";
import { ensureHooksRuntime } from "../workflow/hooks";
import { classifyVoiceIntent } from "./intent.js";
import { getVoiceWorkflowContext } from "./session-context.js";
import {
  handleApprovalIntent,
  handleStatusQuery,
  handleWorkflowIntent,
} from "./workflow-handler.js";

export interface VoiceAssistantInput {
  text: string;
  userId: string;
  projectId?: string;
  language?: string;
  thread?: string;
  resource?: string;
}

export interface VoiceAssistantResult {
  text: string;
  replayId: string | null;
  raw: VoiceAssistantRaw;
  durationSeconds: number;
}

interface FocusState {
  _: "idle" | "active";
  since?: string;
  duration?: number;
  note?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFocusState(value: unknown): FocusState | null {
  if (!isRecord(value)) {
    return null;
  }
  const kind = value._;
  if (kind !== "active" && kind !== "idle") {
    return null;
  }
  const sinceRaw = value.since;
  if (sinceRaw !== undefined && typeof sinceRaw !== "string") {
    return null;
  }
  const durationRaw = value.duration;
  if (durationRaw !== undefined && typeof durationRaw !== "number") {
    return null;
  }
  const noteRaw = value.note;
  if (noteRaw !== undefined && typeof noteRaw !== "string") {
    return null;
  }
  return {
    _: kind,
    duration: durationRaw,
    note: noteRaw,
    since: sinceRaw,
  };
}

function normalizeStart(text: string): string {
  return text.replaceAll(/\s+/g, " ").trim();
}

function applyOpening(opening: string, text: string): string {
  const o = normalizeStart(opening);
  const t = normalizeStart(text);
  if (!o) {
    return t;
  }
  if (!t) {
    return o;
  }
  const lo = o.toLowerCase();
  const lt = t.toLowerCase();
  if (lt.startsWith(lo)) {
    return text.trim();
  }
  return `${o} ${t}`.trim();
}

function coerceString(value: unknown): string | null {
  return typeof value === "string" && value.length ? value : null;
}

function extractToolNames(toolCalls: unknown[]): string[] {
  const out: string[] = [];
  for (const raw of toolCalls) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const obj = raw as Record<string, unknown>;
    const name = coerceString(obj.toolName) ?? coerceString(obj.name);
    if (name) {
      out.push(name);
    }
  }
  return out;
}

function withPersonaTelemetry(input: {
  result: VoiceAssistantResult;
  speechAct:
    | "greet"
    | "ack"
    | "clarify"
    | "answer"
    | "tooling"
    | "recover"
    | "close";
  intent: {
    type: "workflow" | "approval" | "status_query" | "conversational";
    confidence: number | null;
  };
  heuristicFallbackUsed: boolean;
  focusMode: boolean;
  honorific: "sir" | "madam" | "neutral";
  sessionStart: boolean;
  toolCalls?: unknown[];
  toolResults?: unknown[];
}): VoiceAssistantResult {
  const hour = new Date().getHours();
  const greeting = input.sessionStart
    ? formatGreeting({
        honorific: input.honorific,
        timeOfDay: timeOfDayFromHour(hour),
      })
    : "";

  const toolsUsed = extractToolNames(input.toolCalls ?? []);
  const hasToolResults = (input.toolResults ?? []).length > 0;

  const ttsText = adaptForVoice(input.result.text);
  const textWithGreeting = greeting ? applyOpening(greeting, ttsText) : ttsText;

  const uiMessages = input.result.raw.uiMessages.map((m, idx) => {
    if (idx !== 0 || m.role !== "assistant") {
      return m;
    }
    const nextParts = m.parts.map((p, pidx) => {
      if (pidx !== 0) {
        return p;
      }
      if (p.type !== "text") {
        return p;
      }
      return { ...p, text: textWithGreeting };
    });
    return { ...m, parts: nextParts };
  });

  const meta = (input.result.raw.meta ?? {}) as Record<string, unknown>;
  meta.personaTelemetry = {
    constraints: { focusMode: input.focusMode, ttsSafe: true, maxWords: null },
    heuristicFallbackUsed: input.heuristicFallbackUsed,
    intent: { type: input.intent.type, confidence: input.intent.confidence },
    speechAct: input.speechAct,
    tooling: { toolsUsed, hasToolResults },
  };

  return {
    ...input.result,
    text: textWithGreeting,
    raw: {
      ...input.result.raw,
      uiMessages,
      meta,
    },
  };
}

async function getUserFocusState(userId: string): Promise<FocusState | null> {
  try {
    const preferences = (await userRepo.getPreferences(userId)) as unknown as {
      key: string;
      value: unknown;
    }[];
    const entry = preferences.find((pref) => pref.key === "focus");

    const state = parseFocusState(entry?.value);
    if (!state) {
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

function formatCognitiveContext(state: FocusState | null): string {
  if (!state || state._ === "idle") {
    return "";
  }

  const parts = ["[User Context: Active Focus Mode]"];

  if (state.note) {
    parts.push(`Activity: ${state.note}`);
  }

  if (state.duration) {
    parts.push(`Duration: ${state.duration} minutes`);
  }

  parts.push(
    "Instruction: User is in deep work mode. Be concise, direct, and avoid unrelated topics."
  );

  return parts.join("\n");
}

import { DefaultAIAdapter } from "../adapters/ai-generation";

/**
 * Preference key for voice workflow setting.
 * Users can disable via Settings > Voice > Workflow Planning.
 */
export const VOICE_WORKFLOW_PREFERENCE_KEY = "domain.voice.workflow_enabled";

/**
 * Check if voice workflow routing is enabled for a user.
 * Enabled by default; users can disable via preferences.
 */
async function isVoiceWorkflowEnabled(userId: string): Promise<boolean> {
  try {
    const preferences = (await userRepo.getPreferences(userId)) as unknown as {
      key: string;
      value: unknown;
    }[];

    const entry = preferences.find(
      (pref) => pref.key === VOICE_WORKFLOW_PREFERENCE_KEY
    );

    // Default to true if preference not set
    if (!entry) {
      return true;
    }

    // Handle boolean or string values
    const { value } = entry;
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      return value === "true" || value === "1";
    }

    // Default to true for unknown values
    return true;
  } catch {
    // Default to enabled if preference lookup fails
    return true;
  }
}

export async function runAssistantForVoice(
  ctx: RuntimeContext,
  input: VoiceAssistantInput
): Promise<VoiceAssistantResult> {
  // Inject Adapter if missing (Backward Compat / Default behavior)
  if (!ctx.ai) {
    ctx.ai = new DefaultAIAdapter({
      projectId: input.projectId,
      role: "voice",
      userId: input.userId,
    });
  }

  const honorific = await getHonorificPreference(input.userId);
  const focusState = await getUserFocusState(input.userId);
  const focusMode = focusState?._ === "active";
  const sessionStart = !ctx.has?.("voiceAssistantLastRunAt");

  // Voice workflow routing (enabled by default, can be disabled via preferences)
  const workflowEnabled = await isVoiceWorkflowEnabled(input.userId);
  if (workflowEnabled) {
    try {
      const workflowRouted = await routeVoiceWorkflow(ctx, input);
      if (workflowRouted.handled) {
        const speechAct = sessionStart
          ? "greet"
          : workflowRouted.intent.result.type === "approval"
            ? "ack"
            : workflowRouted.intent.result.type === "workflow"
              ? "clarify"
              : workflowRouted.intent.result.type === "status_query"
                ? "answer"
                : "answer";
        ctx.set?.("voiceAssistantLastRunAt", new Date().toISOString());
        return withPersonaTelemetry({
          focusMode,
          heuristicFallbackUsed:
            workflowRouted.intent.meta.heuristicFallbackUsed,
          honorific,
          intent: {
            type: workflowRouted.intent.result.type,
            confidence:
              workflowRouted.intent.result.type === "workflow"
                ? workflowRouted.intent.result.confidence
                : null,
          },
          result: workflowRouted.handled,
          sessionStart,
          speechAct,
          toolCalls: [],
          toolResults: [],
        });
      }
    } catch (error) {
      // Log but fall through to conversational assistant
      logger.warn("voice_workflow_routing_failed", {
        error: error instanceof Error ? error.message : String(error),
        userId: input.userId,
      });
    }
  }

  // Continue with conversational assistant
  return runConversationalAssistant(ctx, input, {
    focusState,
    honorific,
    sessionStart,
  });
}

/**
 * Route voice input to workflow handlers if applicable.
 * Returns null if the input should be handled by the conversational assistant.
 */
async function routeVoiceWorkflow(
  ctx: RuntimeContext,
  input: VoiceAssistantInput
): Promise<{
  handled: VoiceAssistantResult | null;
  intent: Awaited<ReturnType<typeof classifyVoiceIntent>>;
}> {
  // Get existing workflow context for the user
  const sessionContext = await getVoiceWorkflowContext(input.userId);

  // Classify the intent
  const intent = await classifyVoiceIntent(input.text, sessionContext);

  logger.debug("voice_intent_classified", {
    hasSessionContext: !!sessionContext,
    intentType: intent.result.type,
    sessionPhase: sessionContext?.state.phase,
    userId: input.userId,
  });

  // Route based on intent type
  switch (intent.result.type) {
    case "workflow": {
      return {
        handled: await handleWorkflowIntent(ctx, input, sessionContext),
        intent,
      };
    }

    case "approval": {
      return {
        handled: await handleApprovalIntent(
          ctx,
          input,
          sessionContext,
          intent.result.action
        ),
        intent,
      };
    }

    case "status_query": {
      return {
        handled: await handleStatusQuery(ctx, input, intent.result.runId),
        intent,
      };
    }

    default: {
      // Fall through to conversational assistant
      return { handled: null, intent };
    }
  }
}

/**
 * Run the conversational assistant (original implementation).
 */
async function runConversationalAssistant(
  ctx: RuntimeContext,
  input: VoiceAssistantInput,
  persona: {
    honorific: "sir" | "madam" | "neutral";
    focusState: FocusState | null;
    sessionStart: boolean;
  }
): Promise<VoiceAssistantResult> {
  const { getVoiceAgentDefaults } = await import("@alfred/agent/agents");
  const { getModelForRole } = await import("@alfred/agent/selector");
  const defaults = getVoiceAgentDefaults();
  const selection = input.projectId
    ? await getModelForRole("voice", {
        projectId: input.projectId,
        userId: input.userId,
      })
    : await getModelForRole("voice", { userId: input.userId });
  const threadId = input.thread ?? `voice:${input.userId}`;
  const resourceId = input.resource ?? threadId;

  // Fetch conversation history if a thread is provided
  let historyMessages: UIMessage[] = [];
  if (input.thread) {
    const history = await conversationRepo.getConversationHistory(
      input.thread,
      input.userId
    );
    if (history?.messages) {
      historyMessages = history.messages;
    }
  }

  const newMessage: UIMessage = {
    id: `voice-${Date.now()}`,
    parts: [{ type: "text", text: input.text }],
    role: "user",
  };

  const cognitiveContext = formatCognitiveContext(persona.focusState);

  let systemInstructions =
    typeof defaults.instructions === "string"
      ? defaults.instructions
      : JSON.stringify(defaults.instructions);
  if (cognitiveContext) {
    systemInstructions += `\n\n${cognitiveContext}`;
  }

  systemInstructions += `\n\n${buildPersonaPrompt({
    focusMode: persona.focusState?._ === "active",
    honorific: persona.honorific,
    modality: "voice",
  })}`;

  // Combine history with the new message
  const allMessages = [...historyMessages, newMessage];

  const { model } = selection;
  const modelIdStr = selection.modelKey;

  // Apply history context selection (budgeting)
  const historyContext = await buildHistoryContext({
    aggressive: true,
    messages: allMessages,
    modelId: modelIdStr,
    system: systemInstructions, // Be aggressive with pruning for voice latency
  });

  const modelMessages = await prepareModelMessagesForGenerate({
    rawMessages: historyContext.uiMessages, // Use pruned messages
    tools: defaults.tools,
    source: "assistant",
    model: modelIdStr,
    system: systemInstructions,
  });

  const telemetry =
    process.env.AI_TELEMETRY === "1"
      ? {
          experimental_telemetry: {
            functionId: "api.voice.assistant",
            isEnabled: true,
            recordInputs: false,
            recordOutputs: false,
          },
        }
      : {};

  const assistantStart = performance.now();
  const result = await generateText({
    model,
    tools: defaults.tools,
    system: systemInstructions,
    messages: modelMessages,
    ...telemetry,
  });
  const durationSeconds = (performance.now() - assistantStart) / 1000;
  const sanitized = sanitizeResult(result);
  const finalSanitized = sanitized;

  // Track token usage and cost
  try {
    const tracker = getOrCreateTracker({
      budgetUsd: 1,
      modelId: modelIdStr,
      sessionId: threadId, // Default $1 budget for voice sessions
    });

    // Extract usage from result (AI SDK v6 format)
    const usage = result.usage as
      | {
          inputTokens?: number;
          outputTokens?: number;
          cachedInputTokens?: number;
          reasoningTokens?: number;
        }
      | undefined;

    if (usage) {
      tracker.record({
        cachedTokens: usage.cachedInputTokens ?? 0,
        inputTokens: usage.inputTokens ?? 0,
        latencyMs: durationSeconds * 1000,
        modelId: modelIdStr,
        outputTokens: usage.outputTokens ?? 0,
        reasoningTokens: usage.reasoningTokens ?? 0,
      });
    }
  } catch (error) {
    // Don't fail the request if tracking fails
    logger.error("voice_cost_tracking_failed", {
      error: error instanceof Error ? error.message : String(error),
      threadId,
    });
  }
  const replayId = await persistResult({
    input: {
      projectId: input.projectId,
      thread: threadId,
      resource: resourceId,
      messages: [newMessage], // Persist the new interaction
    },
    kind: "assistant",
    projectId: input.projectId,
    result: finalSanitized,
    userId: input.userId,
  });

  ctx.set?.("voiceAssistantLastRunAt", new Date().toISOString());

  // Cognitive Integration: Feed input into the loop
  try {
    await ensureHooksRuntime(ctx, {
      sessionId: String(ctx.get("requestId") ?? input.userId),
      signal: new AbortController().signal,
      workspace: process.cwd(),
      workflowId: threadId,
    });

    const { runCognitiveLoop } = await import("@alfred/runtime");
    const result = await runCognitiveLoop(ctx, threadId, {
      _: "input",
      content: input.text,
      source: "user",
      ts: timestamp(Date.now()),
    });

    await handleVoiceCognitiveEffects({
      durationSeconds,
      effects: result.effects,
      runLoop: runCognitiveLoop,
      runtimeCtx: ctx,
      sanitized: finalSanitized,
      streamId: threadId,
    });
  } catch (error) {
    logger.error("voice_cognitive_integration_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const base: VoiceAssistantResult = {
    durationSeconds,
    raw: {
      uiMessages: [
        {
          id: `voice-assistant-${Date.now()}`,
          role: "assistant",
          parts: [{ type: "text", text: finalSanitized.text ?? "" }],
        },
      ],
      meta: {
        thread: threadId,
        resource: resourceId,
      },
    },
    replayId,
    text: finalSanitized.text ?? "",
  };

  return withPersonaTelemetry({
    focusMode: persona.focusState?._ === "active",
    heuristicFallbackUsed: false,
    honorific: persona.honorific,
    intent: { type: "conversational", confidence: null },
    result: base,
    sessionStart: persona.sessionStart,
    speechAct: persona.sessionStart ? "greet" : "answer",
    toolCalls: finalSanitized.toolCalls,
    toolResults: finalSanitized.toolResults,
  });
}

type RunLoopFn = (
  ctx: RuntimeContext,
  streamId: string,
  event: Event
) => Promise<CognitiveLoopResult>;

interface VoiceEffectParams {
  runtimeCtx: RuntimeContext;
  runLoop: RunLoopFn;
  streamId: string;
  effects: CognitiveEffect[];
  sanitized: ReturnType<typeof sanitizeResult>;
  durationSeconds: number;
}

async function handleVoiceCognitiveEffects(params: VoiceEffectParams) {
  if (!params.effects.length) {
    return;
  }
  const queue: CognitiveEffect[] = [...params.effects];
  while (queue.length) {
    const effect = queue.shift();
    if (!effect) {
      break;
    }
    try {
      switch (effect.type) {
        case "generate_response": {
          const outcome: Outcome = {
            _: "success",
            duration: Math.round(params.durationSeconds * 1000),
            result: params.sanitized,
          };
          const followUp = await params.runLoop(
            params.runtimeCtx,
            params.streamId,
            {
              _: "complete",
              outcome,
              ts: timestamp(Date.now()),
            }
          );
          queue.push(...followUp.effects);
          break;
        }
        default: {
          logger.warn("voice_cognitive_effect_unhandled", {
            streamId: params.streamId,
            effect,
          });
        }
      }
    } catch (error) {
      logger.error("voice_cognitive_effect_failed", {
        effect,
        error: error instanceof Error ? error.message : String(error),
        streamId: params.streamId,
      });
    }
  }
}
