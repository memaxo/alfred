import { getOrchestratorAgentDefaults } from "@alfred/agent";
import { TRPCError } from "@trpc/server";
import { stepCountIs } from "ai";
import { z } from "zod";
import { generateText, persistResult } from "../ai/generate";
import { prepareModelMessagesForGenerate } from "../ai/messages";
import { requirePolicy } from "../gate";
import { authedProcedure, rateLimit, router } from "../trpc";
import { toTRPCError } from "../utils/error";
import { sanitizeResult } from "../utils/generate";
import {
  orchestratorGenerateDurationSeconds,
  orchestratorGenerateRequestsTotal,
} from "../metrics";

const ORCHESTRATOR_MAX_STEPS = 12;

const generateInput = z.object({
  thread: z.string().optional(),
  resource: z.string().optional(),
  messages: z.array(z.unknown()).min(1),
  toolChoice: z.enum(["auto", "none", "required"]).optional(),
  maxSteps: z.number().int().min(1).max(ORCHESTRATOR_MAX_STEPS).optional(),
  memory: z.unknown().optional(),
});

function mapResource(raw: unknown) {
  const input = (raw ?? {}) as z.infer<typeof generateInput> & {
    requirement?: string;
  };
  return {
    kind: "orchestrator" as const,
    id: input.thread ?? input.resource ?? "default",
    attrs: {
      scope: input.resource ?? "self",
    },
  };
}

export const orchestratorRouter: ReturnType<typeof router> = router({
  generate: authedProcedure
    .use(rateLimit)
    .use(requirePolicy("orchestrator.generate", (raw) => mapResource(raw)))
    .input(generateInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      const stopTimer = orchestratorGenerateDurationSeconds.startTimer();
      orchestratorGenerateRequestsTotal.inc({ status: "started" });
      try {
        const defaults = getOrchestratorAgentDefaults();
        const modelMessages = await prepareModelMessagesForGenerate({
          rawMessages: input.messages,
          tools: defaults.tools,
          source: "orchestrator",
        });
        const stopWhen =
          typeof input.maxSteps === "number"
            ? stepCountIs(input.maxSteps)
            : defaults.stopWhen;

        const result = await generateText({
          ...defaults,
          messages: modelMessages,
          toolChoice: input.toolChoice,
          stopWhen,
        });
        const output = sanitizeResult(result);
        const replayId = await persistResult({
          userId: ctx.session.user.id,
          kind: "orchestrator",
          input,
          result: output,
        });
        orchestratorGenerateRequestsTotal.inc({ status: "success" });
        stopTimer({ status: "success" });
        return {
          ...output,
          replayId: replayId ?? undefined,
        } as typeof output & {
          replayId?: string;
        };
      } catch (error) {
        orchestratorGenerateRequestsTotal.inc({ status: "error" });
        stopTimer({ status: "error" });
        throw toTRPCError(error, "orchestrator_error");
      }
    }),
  stream: authedProcedure
    // Streaming moved to HTTP SSE to keep a single transport.
    .input(z.object({}).passthrough())
    .subscription(() => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message:
          "orchestrator.stream has moved to the HTTP SSE endpoint at /api/orchestrator.",
      });
    }),
});
