/**
 * Level 4 Verification: Cognitive Pipeline
 *
 * Exercises the cognitive runtime loop end-to-end with mocked AI output.
 * Confirms that input events trigger thinking, reflections emit complete events,
 * and feedback updates autonomy without external services.
 *
 * Usage: bun scripts/verify-cognitive-pipeline.ts
 */

import { RuntimeContext } from "@alfred/type/runtime-context";
import { runCognitiveLoop } from "@alfred/runtime";
import { cognitiveRepo } from "@alfred/db";
import { logger } from "@alfred/logger";

const STREAM_ID = `verify-cognitive-${Date.now()}`;

const mockAiAdapter = {
  async generateText({ messages }: { messages: Array<{ content: string }> }) {
    const last = messages[messages.length - 1];
    return {
      text: `Mock cognition: ${(last?.content ?? "unknown").slice(0, 60)}`,
      finishReason: "stop",
      toolCalls: [],
      toolResults: [],
      usage: { promptTokens: 0, completionTokens: 0 },
      warnings: [],
    };
  },
  async generateObject() {
    throw new Error("generateObject not implemented in verification adapter");
  },
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verify() {
  logger.info("cognitive_verify_start", { streamId: STREAM_ID });

  const ctx = new RuntimeContext([
    ["requestId", STREAM_ID],
    ["userId", "verify-user"],
    ["scope", "test"],
  ]);
  (ctx as RuntimeContext & { ai: typeof mockAiAdapter }).ai = mockAiAdapter;

  const inputEvent = {
    _: "input" as const,
    content: "Summarize focus state for verification",
    source: "test",
    ts: Date.now() as any,
  };

  await runCognitiveLoop(ctx, STREAM_ID, inputEvent);

  // Allow asynchronous completion generation to run
  await delay(200);

  const feedbackEvent = {
    _: "feedback" as const,
    expected: "Summarize focus state for verification",
    actual: "Summarize focus state for verification",
    ts: Date.now() as any,
  };

  await runCognitiveLoop(ctx, STREAM_ID, feedbackEvent);
  await delay(50);

  const events = await cognitiveRepo.getAllEvents(STREAM_ID);
  const eventSummary = events.map((event) => event.type);
  const hasComplete = eventSummary.includes("complete");
  const hasFeedback = eventSummary.includes("feedback");
  if (!hasComplete || !hasFeedback) {
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
