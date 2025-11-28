import type { Event } from "@alfred/cognitive/state";
import { logger } from "@alfred/logger";
import type { CognitiveEffect } from "@alfred/runtime";
import { runAssistantGeneration, runCognitiveLoop } from "@alfred/runtime";
import { z } from "zod";
import type { Context } from "../context";
import { requirePolicy } from "../gate";
import { cognitiveFeedbackSubmissionsTotal } from "../metrics";
import { authedProcedure, router } from "../trpc";

const feedbackInput = z.object({
  streamId: z.string().min(1),
  expected: z.string().min(1),
  actual: z.string().optional().default(""),
  ts: z.number().int().optional(),
  surface: z.enum(["chat", "mindscape", "voice"]).optional(),
});

type FeedbackInput = z.infer<typeof feedbackInput>;

const mapResource = (raw: unknown) => {
  const payload = (raw ?? {}) as Partial<FeedbackInput>;
  return {
    kind: "cognitive" as const,
    id: payload.streamId ?? "default",
    attrs: {
      scope: "self",
    },
  };
};

const buildContext = (raw: unknown, ctx: Context) => {
  const payload = (raw ?? {}) as Partial<FeedbackInput>;
  return {
    streamId: payload.streamId ?? "default",
    requestId: ctx.runtime.requestId,
    userId: ctx.session?.user.id,
  };
};

export const cognitiveRouter = router({
  feedback: authedProcedure
    .use(
      requirePolicy("cognitive.feedback", mapResource, buildContext, {
        handleObligations: "passThrough",
      })
    )
    .input(feedbackInput)
    .mutation(async ({ ctx, input }) => {
      const event: Event = {
        _: "feedback",
        expected: input.expected,
        actual: input.actual ?? "",
        ts: (input.ts ?? Date.now()) as any,
      };

      const { state, effects } = await runCognitiveLoop(
        ctx.runtimeContext,
        input.streamId,
        event
      );

      await handleCognitiveEffects(ctx.runtimeContext, input.streamId, effects);

      const surface = input.surface ?? "chat";
      cognitiveFeedbackSubmissionsTotal.labels(surface).inc();

      return {
        state,
        obligations: ctx.policy?.obligations ?? [],
      };
    }),
});

async function handleCognitiveEffects(
  runtimeCtx: Context["runtimeContext"],
  streamId: string,
  initialEffects: CognitiveEffect[]
) {
  if (!initialEffects.length) {
    return;
  }

  const queue: CognitiveEffect[] = [...initialEffects];

  while (queue.length) {
    const effect = queue.shift()!;
    try {
      switch (effect.type) {
        case "generate_response": {
          const outcome = await runAssistantGeneration(
            runtimeCtx,
            streamId,
            effect.input
          );
          const followUp = await runCognitiveLoop(runtimeCtx, streamId, {
            _: "complete",
            outcome,
            ts: Date.now() as any,
          });
          queue.push(...followUp.effects);
          break;
        }
        case "execute_plan":
        case "log_reflection":
          logger.warn("cognitive_effect_unhandled", {
            streamId,
            effect,
          });
          break;
        default: {
          const exhaustive: never = effect;
          logger.warn("cognitive_effect_unknown", {
            streamId,
            effect: exhaustive,
          });
        }
      }
    } catch (error) {
      logger.error("cognitive_effect_failed", {
        streamId,
        effect,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
