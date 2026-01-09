import { type Event, type Outcome, timestamp } from "@alfred/cognitive/state";
import * as conversationRepo from "@alfred/db/repo/conversation";
import * as userRepo from "@alfred/db/repo/user";
import { buildHistoryContext } from "@alfred/history/history-context";
import { logger } from "@alfred/logger";
import type { CognitiveEffect, CognitiveLoopResult } from "@alfred/runtime";
import type { RuntimeContext } from "@alfred/type/runtime-context";
import type { UIMessage } from "@alfred/type/stream";
import { generateText, persistResult } from "../ai/generate";
import { prepareModelMessagesForGenerate } from "../ai/messages";
import { sanitizeResult } from "../utils/generate";

export type VoiceAssistantInput = {
  text: string;
  userId: string;
  projectId?: string;
  language?: string;
  thread?: string;
  resource?: string;
};

export type VoiceAssistantResult = {
  text: string;
  replayId: string | null;
  raw: ReturnType<typeof sanitizeResult>;
  durationSeconds: number;
};

type FocusState = {
  _: "idle" | "active";
  since?: string;
  duration?: number;
  note?: string;
};

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
    since: sinceRaw,
    duration: durationRaw,
    note: noteRaw,
  };
}

function resolveModelId(model: unknown): string {
  if (typeof model === "string" && model.length > 0) {
    return model;
  }
  if (isRecord(model)) {
    const modelId = model.modelId;
    if (typeof modelId === "string" && modelId.length > 0) {
      return modelId;
    }
    const id = model.id;
    if (typeof id === "string" && id.length > 0) {
      return id;
    }
  }
  return process.env.AI_MODEL ?? "openai/gpt-4o-mini";
}

function isJarvisPersonaEnabled(): boolean {
  const raw =
    typeof process !== "undefined"
      ? process.env.ENABLE_JARVIS_PERSONA
      : undefined;
  return raw === "1" || raw === "true";
}

function normalizeStart(text: string): string {
  return text.replace(/\s+/g, " ").trim();
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

function looksLikeStatusQuery(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("status") ||
    t.includes("health") ||
    t.includes("systems") ||
    t.includes("diagnostic") ||
    t.includes("uptime")
  );
}

async function getUserFocusState(userId: string): Promise<FocusState | null> {
  try {
    const preferences = (await userRepo.getPreferences(
      userId
    )) as unknown as Array<{ key: string; value: unknown }>;
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

export async function runAssistantForVoice(
  ctx: RuntimeContext,
  input: VoiceAssistantInput
): Promise<VoiceAssistantResult> {
  // Inject Adapter if missing (Backward Compat / Default behavior)
  if (!ctx.ai) {
    ctx.ai = new DefaultAIAdapter();
  }
  const { getAssistantAgentDefaults } = await import("@alfred/agent/agents");
  const defaults = getAssistantAgentDefaults();
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

  const jarvisEnabled = isJarvisPersonaEnabled();
  let jarvisOpening = "";
  let jarvisPersonaBlock: string | null = null;
  if (jarvisEnabled) {
    const { buildJarvisOpening, getPersonaInstruction } = await import(
      "@alfred/agent/assistant/src/adapter"
    );
    jarvisPersonaBlock = getPersonaInstruction([]); // gated inside adapter too
    jarvisOpening = buildJarvisOpening({
      sessionStart:
        input.thread && historyMessages.length > 0
          ? false
          : !ctx.has("voiceAssistantLastRunAt"),
      isSystemStatus: looksLikeStatusQuery(input.text),
      hour: new Date().getHours(),
    });
  }

  const newMessage: UIMessage = {
    id: `voice-${Date.now()}`,
    role: "user",
    parts: [{ type: "text", text: input.text }],
  };

  // Fetch cognitive state (focus mode)
  const focusState = await getUserFocusState(input.userId);
  const cognitiveContext = formatCognitiveContext(focusState);

  let systemInstructions =
    typeof defaults.instructions === "string"
      ? defaults.instructions
      : JSON.stringify(defaults.instructions);
  if (cognitiveContext) {
    systemInstructions += `\n\n${cognitiveContext}`;
  }
  if (jarvisPersonaBlock) {
    systemInstructions += `\n\n${jarvisPersonaBlock}`;
  }
  if (jarvisOpening) {
    systemInstructions += `\n\nVoice UX requirement: Begin your reply with exactly: "${jarvisOpening}" (verbatim). Do not repeat this opening later.`;
  }

  // Combine history with the new message
  const allMessages = [...historyMessages, newMessage];

  const model = defaults.model;
  const modelIdStr = resolveModelId(model);

  // Apply history context selection (budgeting)
  const historyContext = await buildHistoryContext({
    messages: allMessages,
    modelId: modelIdStr,
    system: systemInstructions,
    aggressive: true, // Be aggressive with pruning for voice latency
  });

  const modelMessages = await prepareModelMessagesForGenerate({
    rawMessages: historyContext.uiMessages, // Use pruned messages
    tools: defaults.tools,
    source: "assistant",
    model,
    system: systemInstructions,
  });

  const assistantStart = performance.now();
  const result = await generateText({
    model,
    tools: defaults.tools,
    system: systemInstructions,
    messages: modelMessages,
  });
  const durationSeconds = (performance.now() - assistantStart) / 1000;
  const sanitized = sanitizeResult(result);
  const textWithOpening = jarvisOpening
    ? applyOpening(jarvisOpening, sanitized.text ?? "")
    : (sanitized.text ?? "");
  const finalSanitized =
    textWithOpening === (sanitized.text ?? "")
      ? sanitized
      : { ...sanitized, text: textWithOpening };
  const replayId = await persistResult({
    userId: input.userId,
    projectId: input.projectId,
    kind: "assistant",
    input: {
      projectId: input.projectId,
      thread: threadId,
      resource: resourceId,
      messages: [newMessage], // Persist the new interaction
    },
    result: finalSanitized,
  });

  ctx.set?.("voiceAssistantLastRunAt", new Date().toISOString());

  // Cognitive Integration: Feed input into the loop
  try {
    const { runCognitiveLoop } = await import("@alfred/runtime");
    const result = await runCognitiveLoop(ctx, threadId, {
      _: "input",
      content: input.text,
      source: "user",
      ts: timestamp(Date.now()),
    });

    await handleVoiceCognitiveEffects({
      runtimeCtx: ctx,
      runLoop: runCognitiveLoop,
      streamId: threadId,
      effects: result.effects,
      sanitized: finalSanitized,
      durationSeconds,
    });
  } catch (error) {
    logger.error("voice_cognitive_integration_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    text: finalSanitized.text ?? "",
    replayId,
    raw: finalSanitized,
    durationSeconds,
  };
}

type RunLoopFn = (
  ctx: RuntimeContext,
  streamId: string,
  event: Event
) => Promise<CognitiveLoopResult>;

type VoiceEffectParams = {
  runtimeCtx: RuntimeContext;
  runLoop: RunLoopFn;
  streamId: string;
  effects: CognitiveEffect[];
  sanitized: ReturnType<typeof sanitizeResult>;
  durationSeconds: number;
};

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
            result: params.sanitized,
            duration: Math.round(params.durationSeconds * 1000),
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
        default:
          logger.warn("voice_cognitive_effect_unhandled", {
            streamId: params.streamId,
            effect,
          });
      }
    } catch (error) {
      logger.error("voice_cognitive_effect_failed", {
        streamId: params.streamId,
        effect,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
