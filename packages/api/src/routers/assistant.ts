import { buildAssistantTools, getModelId, getOpenAI } from "@alfred/agent";
import type { UIMessage } from "@alfred/type/stream";
import { uiMessageSchema } from "@alfred/type/stream.zod";
import { TRPCError } from "@trpc/server";
import { convertToModelMessages, stepCountIs } from "ai";
import { z } from "zod";
import { generateText, persistResult } from "../ai/generate";
import { cloneRuntimeContext } from "../context";
import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";
import { toTRPCError } from "../utils/error";
import { sanitizeResult } from "../utils/generate";

const ASSISTANT_MAX_STEPS = 12;

const memorySchema = z
  .object({
    workingMemory: z
      .object({
        scope: z.enum(["thread", "resource"]).optional(),
        template: z.string().optional(),
      })
      .optional(),
    semanticRecall: z
      .object({
        topK: z.number().int().min(1).max(10).optional(),
        messageRange: z.union([
          z.number().int().min(0).max(10),
          z.object({
            before: z.number().int().min(0).max(10),
            after: z.number().int().min(0).max(10),
          }),
        ]),
      })
      .partial()
      .optional(),
  })
  .partial();

const generateInput = z.object({
  thread: z.string().optional(),
  resource: z.string().optional(),
  messages: z.array(z.unknown()).min(1),
  toolChoice: z.enum(["auto", "none", "required"]).optional(),
  maxSteps: z.number().int().min(1).max(ASSISTANT_MAX_STEPS).optional(),
  memory: memorySchema.optional(),
});

const escalateInput = z.object({
  requirement: z.string().min(1),
  auto: z.enum(["read", "low"]).default("read"),
  authz: z.string().optional(),
  workspace: z.string().optional(),
  repoBase: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

type AssistantGenerateInput = z.infer<typeof generateInput>;

function validateMessages(messages: unknown[]): UIMessage[] {
  const validated: UIMessage[] = [];
  for (const msg of messages) {
    const result = uiMessageSchema.safeParse(msg);
    if (!result.success) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "invalid_message",
        cause: result.error,
      });
    }
    validated.push(result.data as UIMessage);
  }
  return validated;
}

function mapResource(raw: unknown) {
  const payload = (raw ?? {}) as Partial<AssistantGenerateInput> & {
    requirement?: string;
  };
  return {
    kind: "assistant" as const,
    id: payload.thread ?? payload.resource ?? "default",
    attrs: {
      scope: payload.resource ?? "self",
    },
  };
}

export const assistantRouter: ReturnType<typeof router> = router({
  generate: authedProcedure
    .use(requirePolicy("assistant.generate", (raw) => mapResource(raw)))
    .input(generateInput)
    .mutation(async ({ input, ctx }) => {
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
          tools: buildAssistantTools(),
          toolChoice: input.toolChoice,
          ...(stopWhen ? { stopWhen } : {}),
        });

        const output = sanitizeResult(result);
        // Persist for replay
        if (!ctx.session) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "session_required",
          });
        }
        const replayId = await persistResult({
          userId: ctx.session.user.id,
          kind: "assistant",
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
        throw toTRPCError(error, "assistant_error");
      }
    }),
  escalate: authedProcedure
    .use(requirePolicy("assistant.escalate", (raw) => mapResource(raw)))
    .input(escalateInput)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      try {
        const { toolHandoff } = await import(
          "@alfred/agent/assistant/tool/handoff"
        );
        const runtimeExtras: [string, unknown][] = [
          ["assistantEscalateRequirement", input.requirement],
          ["assistantEscalateAuto", input.auto],
        ];
        if (input.workspace) {
          runtimeExtras.push(["assistantEscalateWorkspace", input.workspace]);
        }
        if (input.repoBase) {
          runtimeExtras.push(["assistantEscalateRepoBase", input.repoBase]);
        }
        const runtimeContext = cloneRuntimeContext(
          ctx.runtimeContext,
          runtimeExtras
        );
        const result = await toolHandoff.execute({
          input: {
            ...input,
            userId: ctx.session.user.id,
          },
          runtimeContext,
        });
        return result;
      } catch (error) {
        throw toTRPCError(error, "assistant_error");
      }
    }),
});
