import { buildOrchestratorTools, getModelId, getOpenAI } from "@alfred/agent";
import { stepCountIs, type ModelMessage } from "ai";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { callGenerateText } from "../ai/generate";
import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";

const ORCHESTRATOR_MAX_STEPS = 12;

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string().min(1),
});

const generateInput = z.object({
  thread: z.string().optional(),
  resource: z.string().optional(),
  messages: z.array(messageSchema).min(1),
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

function toModelMessages(
  messages: z.infer<typeof generateInput>["messages"]
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

function sanitizeResult(result: unknown) {
  if (!result || typeof result !== "object") {
    return {
      text: "",
      toolCalls: [],
      toolResults: [],
      usage: null,
      warnings: [],
      finishReason: null,
    };
  }

  const output = result as Record<string, unknown>;
  return {
    text: typeof output.text === "string" ? output.text : "",
    toolCalls: Array.isArray(output.toolCalls) ? output.toolCalls : [],
    toolResults: Array.isArray(output.toolResults) ? output.toolResults : [],
    usage: output.usage ?? null,
    warnings: Array.isArray(output.warnings) ? output.warnings : [],
    finishReason:
      typeof output.finishReason === "string" ? output.finishReason : null,
  };
}

function toTrpcError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }
  const message =
    error instanceof Error ? error.message : String(error ?? "orchestrator");
  if (message === "biometric_required") {
    return new TRPCError({ code: "PRECONDITION_FAILED", message });
  }
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message,
    cause: error instanceof Error ? error : undefined,
  });
}

export const orchestratorRouter: ReturnType<typeof router> = router({
  generate: authedProcedure
    .use(requirePolicy("orchestrator.generate", (raw) => mapResource(raw)))
    .input(generateInput)
    .mutation(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      try {
        const model = getOpenAI().chat(getModelId());
        const modelMessages = toModelMessages(input.messages);
        const stopWhen =
          typeof input.maxSteps === "number"
            ? stepCountIs(input.maxSteps)
            : undefined;

        const result = await callGenerateText({
          model,
          messages: modelMessages,
          tools: buildOrchestratorTools(),
          toolChoice: input.toolChoice,
          ...(stopWhen ? { stopWhen } : {}),
        });
        return sanitizeResult(result);
      } catch (error) {
        throw toTrpcError(error);
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
