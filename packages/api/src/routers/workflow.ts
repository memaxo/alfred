import {
  implementationPlanSchema,
  type ImplementationPlan,
  type ModulePlan,
  type Task,
  type WorkflowEvent,
} from "@alfred/type";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";

import { requirePolicy } from "../gate";
import { router, authedProcedure } from "../trpc";
import { runRegistry } from "../run-registry";
import { workflowStreamDurationSeconds, workflowStreamEventsTotal } from "../metrics";

const workflowInput = z.object({
  requirement: z.string().min(1),
  auto: z.enum(["read", "low", "medium", "high"]).default("low"),
  authz: z.string().optional(),
  cw: z.string().optional(),
  mode: z.enum(["sequential", "parallel"]).default("sequential"),
  workspace: z.string().optional(),
  repoBase: z.string().optional(),
  profile: z.string().min(1).optional(),
  authzDeploy: z.string().optional(),
  authzLinear: z.string().optional(),
  preview: z
    .object({
      host: z.string().min(1),
      upstream: z.string().url().optional(),
      tls: z.boolean().optional(),
    })
    .optional(),
  previewBuild: z
    .object({
      context: z.string().min(1),
      dockerfile: z.string().optional(),
      image: z.string().optional(),
      port: z.number().int().min(1).max(65535).optional(),
      env: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  promote: z
    .object({
      host: z.string().min(1),
      upstream: z.string().url(),
      tls: z.boolean().optional(),
    })
    .optional(),
  linear: z
    .object({
      space: z.string().min(1),
      teamId: z.string().optional(),
      sessionId: z.string().optional(),
    })
    .optional(),
  context: z
    .object({
      enable: z.boolean().optional(),
      web: z.boolean().optional(),
      topK: z.number().int().min(1).max(100).optional(),
      maxTokens: z.number().int().min(2000).max(200000).optional(),
      exts: z.array(z.string()).optional(),
      ignore: z.array(z.string()).optional(),
      seeds: z.array(z.string().url()).optional(),
    })
    .optional(),
  userId: z.string().min(1).optional(),
  policyObligations: z.array(z.string()).optional(),
});

const mapWorkflowResource = (raw: unknown) => {
  const input = raw as Partial<z.infer<typeof workflowInput>>;
  return {
    kind: "workflow" as const,
    id: "plan",
    attrs: {
      auto: input?.auto ?? "read",
      mode: input?.mode ?? "sequential",
    },
  };
};

function toTRPCError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "unknown_error";

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message,
    cause: error instanceof Error ? error : undefined,
  });
}

function buildPlaceholderPlan(input: z.infer<typeof workflowInput>): ImplementationPlan {
  const now = new Date();
  const planId = `plan-${randomUUID().slice(0, 8)}`;
  const taskId = `task-${randomUUID().slice(0, 8)}`;
  const moduleId = `module-${randomUUID().slice(0, 8)}`;

  const task: Task = {
    id: taskId,
    title: input.requirement,
    description: `Assess and execute requirement: ${input.requirement}`,
    status: "pending",
    auto: input.auto,
    dependencies: [],
    created: now,
  };

  const module: ModulePlan = {
    id: moduleId,
    path: input.repoBase ?? "./",
    description: `Initial module for ${input.requirement}`,
    tasks: [task],
    status: "pending",
  };

  const plan: ImplementationPlan = implementationPlanSchema.parse({
    id: planId,
    title: `Plan for ${input.requirement}`,
    description: `Auto-generated placeholder plan for ${input.requirement}.`,
    ticket: input.linear?.sessionId,
    modules: [module],
    strategy: input.mode,
    status: "planning",
    created: now,
    metadata: {
      requirement: input.requirement,
      auto: input.auto,
      workspace: input.workspace,
      repoBase: input.repoBase,
    },
  });

  return plan;
}

function buildResultsFromPlan(plan: ImplementationPlan) {
  const results: Array<{
    task: string;
    taskId?: string;
    outcome: string;
    module: string;
    status: "completed" | "failed";
  }> = [];

  for (const module of plan.modules) {
    for (const task of module.tasks) {
      results.push({
        task: task.title,
        taskId: task.id,
        outcome: "pending",
        module: module.description,
        status: "completed",
      });
    }
  }

  return results;
}

export const workflowRouter: ReturnType<typeof router> = router({
  start: authedProcedure
    .use(requirePolicy("workflow.plan", raw => mapWorkflowResource(raw)))
    .input(workflowInput)
    .mutation(async ({ input, ctx }) => {
      const session = ctx.session;
      if (!session) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "session_required" });
      }

      try {
        const runId = randomUUID();
        const summary = `Plan initialized for ${input.requirement}`;
        const plan = buildPlaceholderPlan(input);
        const results = buildResultsFromPlan(plan);

        return {
          runId,
          summary,
          results,
          plan,
          vcs: null,
          report: null,
          planArtifact: null,
          ticketId: input.linear?.sessionId ?? null,
          ticketUrl: null,
        };
      } catch (error) {
        throw toTRPCError(error);
      }
    }),

  stream: authedProcedure
    .use(requirePolicy("workflow.plan", raw => mapWorkflowResource(raw)))
    .input(workflowInput)
    .subscription(({ input, ctx }) =>
      observable<WorkflowEvent>(emit => {
        const session = ctx.session;
        if (!session) {
          emit.error(new TRPCError({ code: "UNAUTHORIZED", message: "session_required" }));
          return () => {};
        }

        const runId = randomUUID();
        const abortController = new AbortController();
        let cancelled = false;
        let timerClosed = false;

        const stopStreamTimer = workflowStreamDurationSeconds.startTimer();
        const closeTimer = (status: "ok" | "error" | "cancel") => {
          if (timerClosed) return;
          stopStreamTimer({ status });
          timerClosed = true;
        };

        const recordEvent = (event: "run" | "chunk" | "progress" | "error" | "complete" | "cancel") => {
          workflowStreamEventsTotal.inc({ event });
        };

        const push = (event: WorkflowEvent) => {
          if (cancelled) return;
          recordEvent(event.type === "progress" ? "progress" : "chunk");
          emit.next(event);
        };

        const asyncTask = (async () => {
          try {
            await runRegistry.register(runId, {
              resume: async ({ resumeData }) => {
                if (cancelled) return;
                push({
                  type: "notice",
                  message: `Authorization '${resumeData.event}' acknowledged.`,
                });
              },
              cancel: async () => {
                cancelled = true;
                abortController.abort();
              },
              abortController,
            });

            recordEvent("run");
            push({ type: "notice", message: `Planning started for ${input.requirement}` });
            emit.next({ type: "run", id: runId } as unknown as WorkflowEvent);
            push({ type: "progress", pct: 10, message: "Analyzing requirement" });
            await delay(150);

            if (cancelled) return;
            push({
              type: "notice",
              message: "Gathering context and preparing orchestrator tools (placeholder).",
            });
            push({ type: "progress", pct: 45, message: "Context preparation complete" });
            await delay(150);

            if (cancelled) return;
            const plan = buildPlaceholderPlan(input);
            push({
              type: "notice",
              message: `Draft plan ready: ${plan.title}`,
            });
            push({ type: "progress", pct: 80, message: "Plan validation" });
            await delay(150);

            if (cancelled) return;
            push({ type: "progress", pct: 100, message: "workflow_completed" });
            recordEvent("complete");
            closeTimer("ok");
            emit.complete();
          } catch (error) {
            recordEvent("error");
            closeTimer("error");
            emit.error(toTRPCError(error));
          } finally {
            await runRegistry.unregister(runId);
          }
        })();

        asyncTask.catch(error => emit.error(toTRPCError(error)));

        return () => {
          cancelled = true;
          abortController.abort();
          void runRegistry.unregister(runId);
          if (!timerClosed) {
            recordEvent("cancel");
            closeTimer("cancel");
          }
        };
      }),
    ),

  resume: authedProcedure
    .input(
      z.object({
        runId: z.string().min(1),
        event: z.enum(["deploy-authz", "linear-authz", "bio-authz"]),
        authz: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const delivered = await runRegistry.dispatchResume(input.runId, {
        event: input.event,
        authz: input.authz,
      });

      if (!delivered) {
        throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
      }

      return { ok: true };
    }),
});
