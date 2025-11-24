import { z } from "zod";
import { runCognitiveLoop } from "@alfred/runtime";
import type { Event } from "@alfred/cognitive/state";
import { authedProcedure, router } from "../trpc";
import { requirePolicy } from "../gate";
import type { Context } from "../context";

const feedbackInput = z.object({
  streamId: z.string().min(1),
  expected: z.string().min(1),
  actual: z.string().min(1),
  ts: z.number().int().optional(),
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
    .use(requirePolicy("cognitive.feedback", mapResource, buildContext))
    .input(feedbackInput)
    .mutation(async ({ ctx, input }) => {
      const event: Event = {
        _: "feedback",
        expected: input.expected,
        actual: input.actual,
        ts: (input.ts ?? Date.now()) as any,
      };

      const state = await runCognitiveLoop(
        ctx.runtimeContext,
        input.streamId,
        event
      );

      return {
        state,
        obligations: ctx.policy?.obligations ?? [],
      };
    }),
});
