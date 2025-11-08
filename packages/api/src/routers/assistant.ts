/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/complexity */
import { buildAssistantTools, getModelId, getOpenAI } from "@alfred/agent";
import { stepCountIs, type ModelMessage } from "ai";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { callGenerateText } from "../ai/generate";
import { cloneRuntimeContext } from "../context";
import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";

const ASSISTANT_MAX_STEPS = 12;

const assistantMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string().min(1),
});

const memoryOptionsSchema = z
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

const assistantGenerateInput = z.object({
  thread: z.string().optional(),
  resource: z.string().optional(),
  messages: z.array(assistantMessageSchema).min(1),
  toolChoice: z.enum(["auto", "none", "required"]).optional(),
  maxSteps: z.number().int().min(1).max(ASSISTANT_MAX_STEPS).optional(),
  memory: memoryOptionsSchema.optional(),
});

const assistantStreamInput = assistantGenerateInput.extend({
  runId: z.string().optional(),
});

const assistantEscalateInput = z.object({
  requirement: z.string().min(1),
  auto: z.enum(["read", "low"]).default("read"),
  authz: z.string().optional(),
  workspace: z.string().optional(),
  repoBase: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

type AssistantGenerateInput = z.infer<typeof assistantGenerateInput>;

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

function toModelMessages(
  messages: AssistantGenerateInput["messages"]
): ModelMessage[] {
  return messages.map(message => {
    if (message.role === "system") {
      return { role: "system", content: message.content } as ModelMessage;
    }
    if (message.role === "assistant" || message.role === "tool") {
      return { role: "assistant", content: message.content } as ModelMessage;
    }
    return { role: "user", content: message.content } as ModelMessage;
  });
}

function toTRPCError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }
  const message =
    error instanceof Error ? error.message : String(error ?? "assistant_error");
  if (message === "biometric_required") {
    return new TRPCError({ code: "PRECONDITION_FAILED", message });
  }
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message,
    cause: error instanceof Error ? error : undefined,
  });
}

function sanitizeGenerateResult(result: unknown) {
  if (!result || typeof result !== "object") {
    return {
      text: "",
      toolCalls: [],
      toolResults: [],
      usage: null,
      object: null,
      steps: [],
      warnings: [],
      reasoning: null,
      finishReason: null,
    };
  }

  const output = result as Record<string, unknown>;
  return {
    text: typeof output.text === "string" ? output.text : "",
    toolCalls: Array.isArray(output.toolCalls) ? output.toolCalls : [],
    toolResults: Array.isArray(output.toolResults) ? output.toolResults : [],
    usage: output.usage ?? null,
    object: output.object ?? null,
    steps: Array.isArray(output.steps) ? output.steps : [],
    warnings: Array.isArray(output.warnings) ? output.warnings : [],
    reasoning: output.reasoning ?? null,
    finishReason:
      typeof output.finishReason === "string" ? output.finishReason : null,
  };
}

export const assistantRouter: ReturnType<typeof router> = router({
  generate: authedProcedure
    .use(requirePolicy("assistant.generate", (raw) => mapResource(raw)))
    .input(assistantGenerateInput)
    .mutation(async ({ input, ctx }) => {
      const session = ctx.session;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      try {
        const model = getOpenAI().chat(getModelId());
        const modelMessages = toModelMessages(input.messages);
        const stopWhen =
          typeof input.maxSteps === "number" ? stepCountIs(input.maxSteps) : undefined;

        const result = await callGenerateText({
          model,
          messages: modelMessages,
          tools: buildAssistantTools(),
          toolChoice: input.toolChoice,
          ...(stopWhen ? { stopWhen } : {}),
        });

        return sanitizeGenerateResult(result);
      } catch (error) {
        throw toTRPCError(error);
      }
    }),

  // Deprecated: use the HTTP SSE endpoint at /api/assistant for streaming responses.
  // TODO: remove this procedure once all clients migrate to the new transport.
  stream: authedProcedure
    .use(requirePolicy("assistant.stream", (raw) => mapResource(raw)))
    .input(assistantStreamInput)
    .subscription(() =>
      observable<never>((emit) => {
        emit.error(
          new TRPCError({
            code: "NOT_IMPLEMENTED",
            message:
              "assistant.stream has moved to the HTTP SSE endpoint at /api/assistant.",
          })
        );
        return () => {
          /* no-op */
        };
      })
    ),

  escalate: authedProcedure
    .use(requirePolicy("assistant.escalate", (raw) => mapResource(raw)))
    .input(assistantEscalateInput)
    .mutation(async ({ input, ctx }) => {
      const session = ctx.session;
      if (!session) {
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
            userId: session.user.id,
          },
          runtimeContext,
        });
        return result;
      } catch (error) {
        throw toTRPCError(error);
      }
    }),
});
