import { TRPCError } from "@trpc/server";
import { stepCountIs } from "ai";
import { z } from "zod";
import { buildAssistantContext } from "../ai/assistant-context";
import { generateText, persistResult } from "../ai/generate";
import { prepareModelMessagesForGenerate } from "../ai/messages";
import { cloneRuntimeContext } from "../context";
import { requirePolicy } from "../gate";
import {
  assistantGenerateDurationSeconds,
  assistantGenerateRequestsTotal,
} from "../metrics";
import { authedProcedure, rateLimit, router } from "../trpc";
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
  projectId: z.string().uuid().optional(),
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

export const assistantRouter = router({
  getConfig: authedProcedure.query(async ({ ctx }) => {
    try {
      const { getModelSpec } = await import("@alfred/agent/models");
      const { getModelForRole } = await import("@alfred/agent/selector");

      const userId = ctx.session?.user?.id;
      const selected = userId
        ? await getModelForRole("chat", { userId })
        : getModelForRole("chat");
      const modelKey = selected.modelKey;
      const spec = getModelSpec(modelKey);
      return {
        modelId: spec.id,
        contextWindow: spec.contextWindow,
      };
    } catch (error) {
      throw toTRPCError(error, "assistant_getconfig_failed");
    }
  }),

  generate: authedProcedure
    .use(rateLimit)
    .use(requirePolicy("assistant.generate", (raw) => mapResource(raw)))
    .input(generateInput)
    .mutation(async ({ input, ctx }) => {
      const stopTimer = assistantGenerateDurationSeconds.startTimer();
      assistantGenerateRequestsTotal.inc({ status: "started" });
      try {
        if (!ctx.session?.user?.id) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "session_required",
          });
        }

        const userId = ctx.session.user.id;
        const { getAssistantAgentDefaults } = await import(
          "@alfred/agent/agents"
        );
        const { getModelForRole } = await import("@alfred/agent/selector");
        const defaults = getAssistantAgentDefaults();
        const selection = input.projectId
          ? await getModelForRole("chat", {
              userId,
              projectId: input.projectId,
            })
          : await getModelForRole("chat", { userId });

        const { systemInstruction } = await buildAssistantContext({
          messages: input.messages,
          memory: input.memory,
          baseInstructions: String(defaults.instructions),
        });

        const modelMessages = await prepareModelMessagesForGenerate({
          rawMessages: input.messages,
          tools: defaults.tools,
          source: "assistant",
          model: selection.modelKey,
          system: systemInstruction, // Injected Persona + RAG
        });
        const stopWhen =
          typeof input.maxSteps === "number"
            ? stepCountIs(input.maxSteps)
            : defaults.stopWhen;

        const telemetry =
          process.env.AI_TELEMETRY === "1"
            ? {
                experimental_telemetry: {
                  isEnabled: true,
                  functionId: "api.assistant.generate",
                  recordInputs: false,
                  recordOutputs: false,
                },
              }
            : {};
        const result = await generateText({
          ...defaults,
          // @ts-expect-error - AI SDK model type needs manual assertion
          model: selection.model as unknown,
          messages: modelMessages,
          toolChoice: input.toolChoice,
          stopWhen,
          ...telemetry,
        });
        assistantGenerateRequestsTotal.inc({ status: "success" });
        stopTimer({ status: "success" });

        const output = sanitizeResult(result);
        // Persist for replay
        const replayId = await persistResult({
          userId,
          projectId: input.projectId,
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
        assistantGenerateRequestsTotal.inc({ status: "error" });
        stopTimer({ status: "error" });
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
