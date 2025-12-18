/**
 * Telemetry Smoke Test: Cognitive Metrics
 *
 * Runs a minimal cognitive loop sequence and asserts that the
 * Prometheus metrics exposed via /api/metrics contain cognitive gauges.
 *
 * Usage: bun scripts/verify-cognitive-health.ts
 */

import {
  cognitiveFeedbackSubmissionsTotal,
  metricsRegistry,
} from "@alfred/api/metrics";
import { timestamp } from "@alfred/cognitive/state";
import type { CognitiveEffect } from "@alfred/runtime";
import { runAssistantGeneration, runCognitiveLoop } from "@alfred/runtime";
import { RuntimeContext } from "@alfred/type/runtime-context";

process.env.OPENAI_API_KEY ??= "dummy";
process.env.DATABASE_URL ??= "sqlite::memory:";
process.env.BUN_TEST ??= "1";

const mockAiAdapter = {
  generateText({ messages }: { messages: Array<{ content?: string }> }) {
    const content = messages.at(-1)?.content ?? "unknown";
    return {
      text: `Mock cognitive response: ${content}`,
      finishReason: "stop",
      toolCalls: [],
      toolResults: [],
      warnings: [],
      usage: { promptTokens: 0, completionTokens: 0 },
    };
  },
  generateObject() {
    throw new Error("generateObject not implemented in telemetry check");
  },
};

async function verifyMetrics() {
  const streamId = `health-${Date.now()}`;
  const ctx = new RuntimeContext([
    ["requestId", streamId],
    ["scanContext", null],
  ]);
  (ctx as RuntimeContext & { ai: typeof mockAiAdapter }).ai = mockAiAdapter;

  const inputResult = await runCognitiveLoop(ctx, streamId, {
    _: "input",
    content: "Telemetry focus check",
    source: "test",
    ts: timestamp(Date.now()),
  });
  await processEffects(ctx, streamId, inputResult.effects);

  const interruptResult = await runCognitiveLoop(ctx, streamId, {
    _: "interrupt",
    reason: "loop detected",
    priority: 1,
    ts: timestamp(Date.now()),
  });
  await processEffects(ctx, streamId, interruptResult.effects);

  // Ensure feedback counter reports in metrics output even if no UI submission
  cognitiveFeedbackSubmissionsTotal.labels("script").inc(0);

  const metricsText = await metricsRegistry.metrics();
  if (!metricsText.includes("cognitive_physiology_gauge")) {
    throw new Error("cognitive_physiology_gauge missing from registry output.");
  }
  if (!metricsText.includes("cognitive_entropy_events_total")) {
    throw new Error(
      "cognitive_entropy_events_total missing from registry output."
    );
  }
  if (!metricsText.includes("cognitive_feedback_submissions_total")) {
    throw new Error(
      "cognitive_feedback_submissions_total missing from registry output."
    );
  }

  console.log("✅ Cognitive health metrics verified.");
}

async function processEffects(
  ctx: RuntimeContext,
  streamId: string,
  effects: CognitiveEffect[]
) {
  const queue: CognitiveEffect[] = [...effects];
  while (queue.length) {
    const effect = queue.shift();
    if (!effect) {
      break;
    }
    try {
      if (effect.type !== "generate_response") {
        continue;
      }
      const outcome = await runAssistantGeneration(ctx, streamId, effect.input);
      const { effects: followUp } = await runCognitiveLoop(ctx, streamId, {
        _: "complete",
        outcome,
        ts: timestamp(Date.now()),
      });
      queue.push(...followUp);
    } catch (error) {
      console.error("cognitive_health_effect_failed", {
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
    await verifyMetrics();
    process.exit(0);
  } catch (error) {
    console.error("❌ Cognitive health verification failed.");
    console.error(error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
