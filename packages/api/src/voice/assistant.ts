import type { RuntimeContext } from "@alfred/type/runtime-context";
import type { UIMessage } from "@alfred/type/stream";
import { getAssistantAgentDefaults } from "@alfred/agent";
import { prepareModelMessagesForGenerate } from "../ai/messages";
import { generateText, persistResult } from "../ai/generate";
import { sanitizeResult } from "../utils/generate";

export interface VoiceAssistantInput {
  text: string;
  userId: string;
  language?: string;
  thread?: string;
  resource?: string;
}

export interface VoiceAssistantResult {
  text: string;
  replayId: string | null;
  raw: ReturnType<typeof sanitizeResult>;
  durationSeconds: number;
}

export async function runAssistantForVoice(
  ctx: RuntimeContext,
  input: VoiceAssistantInput
): Promise<VoiceAssistantResult> {
  const defaults = getAssistantAgentDefaults();
  const threadId = input.thread ?? `voice:${input.userId}`;
  const resourceId = input.resource ?? threadId;
  const messages: UIMessage[] = [
    {
      id: `voice-${Date.now()}`,
      role: "user",
      name: "voice",
      parts: [{ type: "text", text: input.text }],
    },
  ];

  const modelMessages = await prepareModelMessagesForGenerate({
    rawMessages: messages,
    tools: defaults.tools,
    source: "assistant",
    model: defaults.model,
    system: defaults.instructions,
  });

  const assistantStart = performance.now();
  const result = await generateText({
    ...defaults,
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
      messages,
    },
    result: sanitized,
  });

  ctx.set?.("voiceAssistantLastRunAt", new Date().toISOString());

  return {
    text: sanitized.text ?? "",
    replayId,
    raw: sanitized,
    durationSeconds,
  };
}
