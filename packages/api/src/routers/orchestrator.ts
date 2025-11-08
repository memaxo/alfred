import { buildTools, getModelId, getOpenAI } from "@alfred/agent";
import type { UIMessage } from "@alfred/type/stream";
import { uiMessageSchema } from "@alfred/type/stream.zod";
import { TRPCError } from "@trpc/server";
import { convertToModelMessages, stepCountIs } from "ai";
import { z } from "zod";
import { generateText, persistResult } from "../ai/generate";
import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";
import { toTRPCError } from "../utils/error";
import { sanitizeResult } from "../utils/generate";

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

function validateMessages(messages: unknown[]): UIMessage[] {
  const validated: UIMessage[] = [];
  for (const msg of messages) {
    const result = uiMessageSchema.safeParse(msg);
    if (!result.success) {
      throw new Error(`Invalid message: ${result.error.message}`);
    }
    validated.push(result.data as UIMessage);
  }
  return validated;
}

export const orchestratorRouter: ReturnType<typeof router> = router({
  generate: authedProcedure
    .use(requirePolicy("orchestrator.generate", (raw) => mapResource(raw)))
    .input(generateInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session) {
        throw new Error("Session required");
      }
      try {
        const model = getOpenAI().chat(getModelId());
        const validatedMessages = validateMessages(input.messages);
        const modelMessages = convertToModelMessages(validatedMessages);
        const stopWhen =
          typeof input.maxSteps === "number"
            ? stepCountIs(input.maxSteps)
            : undefined;

        const result = await generateText({
          model,
          messages: modelMessages,
          tools: buildTools(),
          toolChoice: input.toolChoice,
          ...(stopWhen ? { stopWhen } : {}),
        });
        const output = sanitizeResult(result);
        const replayId = await persistResult({
          userId: ctx.session.user.id,
          kind: "orchestrator",
          input,
          result: output,
        });
        return {
          ...output,
          replayId: replayId ?? undefined,
        } as typeof output & {
          replayId?: string;
        };
      } catch (error) {
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
