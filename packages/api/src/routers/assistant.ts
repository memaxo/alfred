import { buildPersonaPrompt } from "@alfred/persona";
import { TRPCError } from "@trpc/server";
import { stepCountIs } from "ai";
import { z } from "zod";

import { cloneRuntimeContext } from "../context";
import { requirePolicy } from "../gate";
import { getHonorificPreference } from "../persona/honorific";
import { authedProcedure, rateLimit, router } from "../trpc";
import { toTRPCError } from "../utils/error";
import { sanitizeResult } from "../utils/generate";
import { ensureHooksRuntime } from "../workflow/hooks";

const ASSISTANT_MAX_STEPS = 12;

const memorySchema = z
  .object({
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
    workingMemory: z
      .object({
        scope: z.enum(["thread", "resource"]).optional(),
        template: z.string().optional(),
      })
      .optional(),
  })
  .partial();

const generateInput = z.object({
  maxSteps: z.number().int().min(1).max(ASSISTANT_MAX_STEPS).optional(),
  memory: memorySchema.optional(),
  messages: z.array(z.unknown()).min(1),
  projectId: z.string().uuid().optional(),
  resource: z.string().optional(),
  thread: z.string().optional(),
  toolChoice: z.enum(["auto", "none", "required"]).optional(),
});

const escalateInput = z.object({
  authz: z.string().optional(),
  auto: z.enum(["read", "low"]).default("read"),
  context: z.record(z.string(), z.unknown()).optional(),
  repoBase: z.string().optional(),
  requirement: z.string().min(1),
  workspace: z.string().optional(),
});

type AssistantGenerateInput = z.infer<typeof generateInput>;

function mapResource(raw: unknown) {
  const payload = (raw ?? {}) as Partial<AssistantGenerateInput> & {
    requirement?: string;
  };
  return {
    attrs: {
      scope: payload.resource ?? "self",
    },
    id: payload.thread ?? payload.resource ?? "default",
    kind: "assistant" as const,
  };
}

export const assistantRouter = router({
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
        // Use injected dependency or fall back to direct import
        const handoffExecuteFn = ctx.deps?.assistant?.handoffExecute;
        if (handoffExecuteFn) {
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
          const result = await handoffExecuteFn({
            input: {
              ...input,
              userId: ctx.session.user.id,
            },
            runtimeContext,
          });
          return result;
        }

        // Fallback to direct import
        const { toolHandoff } =
          await import("@alfred/agent/assistant/tool/handoff");
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

  generate: authedProcedure
    .use(rateLimit)
    .use(requirePolicy("assistant.generate", (raw) => mapResource(raw)))
    .input(generateInput)
    .mutation(async ({ input, ctx }) => {
      const {
        assistantGenerateDurationSeconds,
        assistantGenerateRequestsTotal,
      } = await import("../metrics");
      const stopTimer = assistantGenerateDurationSeconds.startTimer();
      assistantGenerateRequestsTotal.inc({ status: "started" });
      try {
        if (!ctx.session?.user?.id) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "session_required",
          });
        }

        const [
          { buildAssistantContext },
          { prepareModelMessagesForGenerate },
          generateModule,
        ] = await Promise.all([
          import("../ai/assistant-context"),
          import("../ai/messages"),
          import("../ai/generate"),
        ]);

        const userId = ctx.session.user.id;
        const { getAssistantAgentDefaults } =
          await import("@alfred/agent/agents");
        const { getModelForRole } = await import("@alfred/agent/selector");
        const defaults = getAssistantAgentDefaults();
        const selection = input.projectId
          ? await getModelForRole("chat", {
              userId,
              projectId: input.projectId,
            })
          : await getModelForRole("chat", { userId });

        const { ContextBudgetManager } =
          await import("@alfred/history/budget-manager");
        const budgetManager = new ContextBudgetManager({
          modelId: selection.modelKey,
          coreToolNames: defaults.tools
            ? Object.keys(defaults.tools)
            : undefined,
        });

        const honorific = await getHonorificPreference(userId);
        const baseInstructions = [
          buildPersonaPrompt({ modality: "text", honorific }),
          "Offer direct, actionable responses and prefer concrete steps over small talk.",
          "Only explain tool calls when the user needs the reasoning.",
        ].join("\n\n");
        const { systemInstruction, budgetManager: finalBudget } =
          await buildAssistantContext({
            messages: input.messages,
            memory: input.memory,
            baseInstructions,
            modelId: selection.modelKey,
            budgetManager,
          });

        const modelMessages = await prepareModelMessagesForGenerate({
          rawMessages: input.messages,
          tools: defaults.tools,
          source: "assistant",
          model: selection.modelKey,
          system: systemInstruction, // Injected Persona + RAG
          budgetManager: finalBudget,
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

        const hooks = await ensureHooksRuntime(ctx.runtimeContext, {
          sessionId: ctx.session.session.id,
          signal: new AbortController().signal,
          workspace: process.cwd(),
          workflowId: input.thread ?? input.resource,
        });
        // Use injected dependency or fall back to direct import
        const generateTextFn =
          ctx.deps?.assistant?.generateText ?? generateModule.generateText;
        const result = await generateTextFn({
          ...defaults,
          // @ts-expect-error - AI SDK model type needs manual assertion
          model: selection.model as unknown,
          messages: modelMessages,
          toolChoice: input.toolChoice,
          stopWhen,
          experimental_context: { hooks },
          ...telemetry,
        });
        assistantGenerateRequestsTotal.inc({ status: "success" });
        stopTimer({ status: "success" });

        const output = sanitizeResult(result);

        // Extract SchemaContext for GenUI enrichment
        // Determine surface from user agent or default to "web"
        const userAgent = ctx.runtime.userAgent ?? "";
        let surface: "web" | "mobile" | "voice" | "tui" = "web";
        if (
          userAgent.includes("Mobile") ||
          userAgent.includes("Android") ||
          userAgent.includes("iPhone")
        ) {
          surface = "mobile";
        }

        const schemaContext = {
          userId,
          projectId: input.projectId,
          surface,
          mode: "assistant" as const,
        };

        // Persist for replay with async normalization
        const persistResultFn =
          ctx.deps?.assistant?.persistResult ?? generateModule.persistResult;
        const replayId = await persistResultFn({
          userId,
          projectId: input.projectId,
          kind: "assistant",
          input,
          result: output,
          schemaContext,
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
  getConfig: authedProcedure.query(async ({ ctx }) => {
    try {
      const { getModelSpec } = await import("@alfred/agent/models");
      const { getModelForRole } = await import("@alfred/agent/selector");

      const userId = ctx.session?.user?.id;
      const selected = userId
        ? await getModelForRole("chat", { userId })
        : getModelForRole("chat");
      const { modelKey } = selected;
      const spec = getModelSpec(modelKey);
      return {
        modelId: spec.id,
        contextWindow: spec.contextWindow,
      };
    } catch (error) {
      throw toTRPCError(error, "assistant_getconfig_failed");
    }
  }),
});
