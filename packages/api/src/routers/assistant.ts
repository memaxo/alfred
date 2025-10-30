import { assistantAgent } from "@alfred/agent";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { authedProcedure, router } from "../index";
import { assistantStreamDurationSeconds, assistantStreamEventsTotal } from "../metrics";
import { requirePolicy } from "../gate";
import { cloneRuntimeContext } from "../context";

const assistantMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string().min(1),
});

const memoryOptionsSchema = z.object({
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
        z.object({ before: z.number().int().min(0).max(10), after: z.number().int().min(0).max(10) }),
      ]),
    })
    .partial()
    .optional(),
}).partial();

const assistantGenerateInput = z.object({
  thread: z.string().optional(),
  resource: z.string().optional(),
  messages: z.array(assistantMessageSchema).min(1),
  toolChoice: z.enum(["auto", "none", "required"]).optional(),
  maxSteps: z.number().int().min(1).max(12).optional(),
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
  const payload = (raw ?? {}) as Partial<AssistantGenerateInput> & { requirement?: string };
  return {
    kind: "assistant" as const,
    id: payload.thread ?? payload.resource ?? "default",
    attrs: {
      scope: payload.resource ?? "self",
    },
  };
}

function toAgentMessages(messages: AssistantGenerateInput["messages"]) {
  return messages.map(message => ({ role: message.role, content: message.content })) as any;
}

function toMemoryConfig(input: AssistantGenerateInput, userId: string) {
  const threadId = input.thread ?? userId;
  const resource = input.resource ?? userId;
  const options = input.memory ? { ...input.memory } : undefined;
  const config = {
    thread: threadId,
    resource,
    options,
  } as any;
  return config;
}

function toTRPCError(error: unknown): TRPCError {
  if (error instanceof TRPCError) return error;
  const message = error instanceof Error ? error.message : String(error ?? "assistant_error");
  if (message === "biometric_required") {
    return new TRPCError({ code: "PRECONDITION_FAILED", message });
  }
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message, cause: error instanceof Error ? error : undefined });
}

function sanitizeGenerateResult(result: unknown) {
  if (!result || typeof result !== "object") {
    return { text: "", toolCalls: [], usage: null, object: null, steps: [], warnings: [] };
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
    finishReason: typeof output.finishReason === "string" ? output.finishReason : null,
  };
}

export const assistantRouter: ReturnType<typeof router> = router({
  generate: authedProcedure
    .use(requirePolicy("assistant.generate", raw => mapResource(raw)))
    .input(assistantGenerateInput)
    .mutation(async ({ input, ctx }) => {
      const session = ctx.session;
      if (!session) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "session_required" });
      }

      try {
        const messages = toAgentMessages(input.messages) as any;
        const threadId = input.thread ?? session.user.id;
        const resource = input.resource ?? session.user.id;
        const memory = toMemoryConfig(input, session.user.id);
        const runtimeExtras: Array<[string, unknown]> = [
          ["assistantThread", threadId],
          ["assistantResource", resource],
          ["assistantMessageCount", input.messages.length],
        ];
        if (input.toolChoice) {
          runtimeExtras.push(["assistantToolChoice", input.toolChoice]);
        }
        if (typeof input.maxSteps === "number") {
          runtimeExtras.push(["assistantMaxSteps", input.maxSteps]);
        }
        const runtimeContext = cloneRuntimeContext(ctx.runtimeContext, runtimeExtras);

        const result = await assistantAgent.generate(messages, {
          memory,
          runtimeContext,
          maxSteps: input.maxSteps,
          toolChoice: input.toolChoice,
        });

        return sanitizeGenerateResult(result);
      } catch (error) {
        throw toTRPCError(error);
      }
    }),

  stream: authedProcedure
    .use(requirePolicy("assistant.stream", raw => mapResource(raw)))
    .input(assistantStreamInput)
    .subscription(({ input, ctx }) =>
      observable<Record<string, unknown>>(emit => {
        const session = ctx.session;
        if (!session) {
          emit.error(new TRPCError({ code: "UNAUTHORIZED", message: "session_required" }));
          return () => {};
        }

        let active = true;
        const stopStreamTimer = assistantStreamDurationSeconds.startTimer();
        let timerClosed = false;
        const closeTimer = (status: "ok" | "error" | "cancel") => {
          if (timerClosed) return;
          stopStreamTimer({ status });
          timerClosed = true;
        };
        const recordEvent = (event: "run" | "final" | "chunk" | "complete" | "error" | "cancel") => {
          assistantStreamEventsTotal.inc({ event });
        };

        (async () => {
          try {
            const messages = toAgentMessages(input.messages) as any;
            const threadId = input.thread ?? session.user.id;
            const resource = input.resource ?? session.user.id;
            const memory = toMemoryConfig(input, session.user.id);
            const runtimeExtras: Array<[string, unknown]> = [
              ["assistantThread", threadId],
              ["assistantResource", resource],
              ["assistantMessageCount", input.messages.length],
              ["assistantStream", true],
            ];
            if (input.toolChoice) {
              runtimeExtras.push(["assistantToolChoice", input.toolChoice]);
            }
            if (typeof input.maxSteps === "number") {
              runtimeExtras.push(["assistantMaxSteps", input.maxSteps]);
            }
            if (input.runId) {
              runtimeExtras.push(["assistantRequestedRunId", input.runId]);
            }
            const runtimeContext = cloneRuntimeContext(ctx.runtimeContext, runtimeExtras);

            const streamResult = await assistantAgent.stream(messages, {
              memory,
              runtimeContext,
              maxSteps: input.maxSteps,
              toolChoice: input.toolChoice,
              runId: input.runId,
            });

            const runId = (streamResult as { runId?: string }).runId ?? null;
            if (runId) {
              recordEvent("run");
              emit.next({ type: "run", runId });
            }

            const baseStream: ReadableStream | undefined = (streamResult as any)?._getBaseStream?.();

            if (!baseStream) {
              const final = sanitizeGenerateResult(await (streamResult as any).getFullOutput?.());
              recordEvent("final");
              emit.next({ type: "final", data: final });
              recordEvent("complete");
              closeTimer("ok");
              emit.complete();
              return;
            }

            const reader = baseStream.getReader();

            try {
              while (active) {
                const { value, done } = await reader.read();
                if (done) break;
                if (!active) break;
                recordEvent("chunk");
                emit.next(value as Record<string, unknown>);
              }
              if (active) {
                recordEvent("complete");
                closeTimer("ok");
                emit.complete();
              }
            } finally {
              reader.releaseLock();
            }
          } catch (error) {
            recordEvent("error");
            closeTimer("error");
            emit.error(toTRPCError(error));
          }
        })().catch(error => emit.error(toTRPCError(error)));

        return () => {
          active = false;
          if (!timerClosed) {
            recordEvent("cancel");
            closeTimer("cancel");
          }
        };
      }),
    ),

  escalate: authedProcedure
    .use(requirePolicy("assistant.escalate", raw => mapResource(raw)))
    .input(assistantEscalateInput)
    .mutation(async ({ input, ctx }) => {
      const session = ctx.session;
      if (!session) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "session_required" });
      }

      try {
        const { toolHandoff } = await import("@alfred/agent/assistant/tool/handoff");
        const runtimeExtras: Array<[string, unknown]> = [
          ["assistantEscalateRequirement", input.requirement],
          ["assistantEscalateAuto", input.auto],
        ];
        if (input.workspace) {
          runtimeExtras.push(["assistantEscalateWorkspace", input.workspace]);
        }
        if (input.repoBase) {
          runtimeExtras.push(["assistantEscalateRepoBase", input.repoBase]);
        }
        const runtimeContext = cloneRuntimeContext(ctx.runtimeContext, runtimeExtras);
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
