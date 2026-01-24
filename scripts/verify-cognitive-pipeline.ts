/**
 * Level 4 Verification: Cognitive Pipeline
 *
 * Exercises the cognitive runtime loop end-to-end with mocked AI output.
 * Confirms that input events trigger thinking, reflections emit complete events,
 * and feedback updates autonomy without external services.
 *
 * Usage: bun scripts/verify-cognitive-pipeline.ts
 */

import type { CognitiveEffect } from "@alfred/runtime";

import { timestamp } from "@alfred/cognitive/state";
import { cognitiveRepo } from "@alfred/db";
import { logger } from "@alfred/logger";
import { runAssistantGeneration, runCognitiveLoop } from "@alfred/runtime";
import { RuntimeContext } from "@alfred/type/runtime-context";

const STREAM_ID = `verify-cognitive-${Date.now()}`;

const mockAiAdapter = {
  generateText({ messages }: { messages: Array<{ content: string }> }) {
    const last = messages.at(-1);
    return {
      text: `Mock cognition: ${(last?.content ?? "unknown").slice(0, 60)}`,
      finishReason: "stop",
      toolCalls: [],
      toolResults: [],
      usage: { promptTokens: 0, completionTokens: 0 },
      warnings: [],
    };
  },
  generateObject() {
    throw new Error("generateObject not implemented in verification adapter");
  },
};

async function verify() {
  logger.info("cognitive_verify_start", { streamId: STREAM_ID });

  const ctx = new RuntimeContext([
    ["requestId", STREAM_ID],
    ["userId", "verify-user"],
    ["scope", "test"],
    ["scanContext", null],
  ]);
  (ctx as RuntimeContext & { ai: typeof mockAiAdapter }).ai = mockAiAdapter;

  const inputEvent = {
    _: "input" as const,
    content: "Summarize focus state for verification",
    source: "test",
    ts: timestamp(Date.now()),
  };

  const initialResult = await runCognitiveLoop(ctx, STREAM_ID, inputEvent);
  await processEffects(ctx, STREAM_ID, initialResult.effects);

  const feedbackEvent = {
    _: "feedback" as const,
    expected: "Summarize focus state for verification",
    actual: "Summarize focus state for verification",
    ts: timestamp(Date.now()),
  };

  const feedbackResult = await runCognitiveLoop(ctx, STREAM_ID, feedbackEvent);
  await processEffects(ctx, STREAM_ID, feedbackResult.effects);

  const events = await cognitiveRepo.getAllEvents(STREAM_ID);
  const eventSummary = events.map((event) => event.type);
  const hasComplete = eventSummary.includes("complete");
  const hasFeedback = eventSummary.includes("feedback");
  if (!(hasComplete && hasFeedback)) {
    throw new Error(
      `Missing expected events (complete=${hasComplete}, feedback=${hasFeedback})`
    );
  }

  logger.info("cognitive_verify_success", {
    streamId: STREAM_ID,
    events: eventSummary,
  });
  console.log("✅ Cognitive pipeline verification passed.");
}

async function processEffects(
  ctx: RuntimeContext,
  streamId: string,
  effects: CognitiveEffect[]
) {
  if (!effects.length) {
    return;
  }

  const queue: CognitiveEffect[] = [...effects];
  while (queue.length) {
    const effect = queue.shift();
    if (!effect) {
      break;
    }
    try {
      switch (effect.type) {
        case "generate_response": {
          const outcome = await runAssistantGeneration(
            ctx,
            streamId,
            effect.input
          );
          const { effects: followUp } = await runCognitiveLoop(ctx, streamId, {
            _: "complete",
            outcome,
            ts: timestamp(Date.now()),
          });
          queue.push(...followUp);
          break;
        }
        default:
          logger.warn("verify_cognitive_effect_unhandled", {
            streamId,
            effect,
          });
      }
    } catch (error) {
      logger.error("verify_cognitive_effect_failed", {
        streamId,
        effect,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

async function main() {
  try {
    await verify();
    process.exit(0);
  } catch (error) {
    logger.error("cognitive_verify_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    console.error("❌ Cognitive pipeline verification failed.");
    console.error(error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
