import { getAssistantAgentDefaults } from "@alfred/agent";
import type { Event, Outcome } from "@alfred/cognitive/state";
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

async function getUserFocusState(userId: string): Promise<FocusState | null> {
  try {
    const preferences = (await userRepo.getPreferences(
      userId
    )) as unknown as Array<{ key: string; value: unknown }>;
    const entry = preferences.find((pref) => pref.key === "focus");

    if (!entry?.value || typeof entry.value !== "object") {
      return null;
    }

    const candidate = entry.value as any;
    if (candidate._ !== "active" && candidate._ !== "idle") {
      return null;
    }

    return {
      _: candidate._,
      since: candidate.since,
      duration: candidate.duration,
      note: candidate.note,
    };
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

  const newMessage: UIMessage = {
    id: `voice-${Date.now()}`,
    role: "user",
    parts: [{ type: "text", text: input.text }],
  };

  // Fetch cognitive state (focus mode)
  const focusState = await getUserFocusState(input.userId);
  const cognitiveContext = formatCognitiveContext(focusState);

  let systemInstructions = defaults.instructions;
  if (cognitiveContext) {
    systemInstructions += `\n\n${cognitiveContext}`;
  }

  // Combine history with the new message
  const allMessages = [...historyMessages, newMessage];

  const modelIdStr =
    typeof defaults.model === "string"
      ? defaults.model
      : ((defaults.model as any).modelId ??
        (defaults.model as any).id ??
        "unknown");

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
    model: defaults.model,
    system: systemInstructions,
  });

  const assistantStart = performance.now();
  const result = await generateText({
    ...defaults,
    system: systemInstructions,
    messages: modelMessages,
  });
  const durationSeconds = (performance.now() - assistantStart) / 1000;
  const sanitized = sanitizeResult(result);
  const replayId = await persistResult({
    userId: input.userId,
    kind: "assistant",
    input: {
      thread: threadId,
      resource: resourceId,
      messages: [newMessage], // Persist the new interaction
    },
    result: sanitized,
  });

  ctx.set?.("voiceAssistantLastRunAt", new Date().toISOString());

  // Cognitive Integration: Feed input into the loop
  try {
    const { runCognitiveLoop } = await import("@alfred/runtime");
    const result = await runCognitiveLoop(ctx, threadId, {
      _: "input",
      content: input.text,
      source: "user",
      ts: Date.now() as any,
    });

    await handleVoiceCognitiveEffects({
      runtimeCtx: ctx,
      runLoop: runCognitiveLoop,
      streamId: threadId,
      effects: result.effects,
      sanitized,
      durationSeconds,
    });
  } catch (error) {
    logger.error("voice_cognitive_integration_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    text: sanitized.text ?? "",
    replayId,
    raw: sanitized,
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
              ts: Date.now() as any,
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
