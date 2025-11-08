import * as workflowRepo from "@alfred/db/repo/workflow";
import type { WorkflowEvent } from "@alfred/type";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { requirePolicy } from "../gate";
import {
  workflowStreamDurationSeconds,
  workflowStreamEventsTotal,
} from "../metrics";
import { runRegistry } from "../run-registry";
import { authedProcedure, router } from "../trpc";
import { toTRPCError } from "../utils/error";
import { runPlanV6 } from "../workflow/runner";

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
      port: z.number().int().min(1).max(65_535).optional(),
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
      maxTokens: z.number().int().min(2000).max(200_000).optional(),
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

export const workflowRouter: ReturnType<typeof router> = router({
  start: authedProcedure
    .use(requirePolicy("workflow.plan", (raw) => mapWorkflowResource(raw)))
    .input(workflowInput)
    .mutation(async ({ input, ctx }) => {
      const session = ctx.session;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      try {
        const runner = runPlanV6(
          {
            requirement: input.requirement,
            auto: input.auto,
            workspace: input.workspace,
            repoBase: input.repoBase,
            mode: input.mode,
            context: input.context,
          },
          { signal: new AbortController().signal }
        );

        // Create durable run row now so clients may hydrate history
        await workflowRepo.createRun({
          id: runner.runId,
          userId: session.user.id,
          workflowId: "plan",
          status: "running",
          inputData: input,
        });

        return {
          runId: runner.runId,
          summary: runner.summary,
          results: [],
          plan: null,
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
    .use(requirePolicy("workflow.plan", (raw) => mapWorkflowResource(raw)))
    .input(workflowInput)
    .subscription(({ input, ctx }) =>
      observable<WorkflowEvent>((emit) => {
        const session = ctx.session;
        if (!session) {
          emit.error(
            new TRPCError({ code: "UNAUTHORIZED", message: "session_required" })
          );
          return () => {};
        }

        const abortController = new AbortController();
        let cancelled = false;
        let timerClosed = false;

        const stopStreamTimer = workflowStreamDurationSeconds.startTimer();
        const closeTimer = (status: "ok" | "error" | "cancel") => {
          if (timerClosed) return;
          stopStreamTimer({ status });
          timerClosed = true;
        };

        const recordEvent = (
          event: "run" | "chunk" | "progress" | "error" | "complete" | "cancel"
        ) => {
          workflowStreamEventsTotal.inc({ event });
        };

        const push = (event: WorkflowEvent) => {
          if (cancelled) return;
          recordEvent(event.type === "progress" ? "progress" : "chunk");
          emit.next(event);
        };

        const asyncTask = (async () => {
          let runId: string | null = null;
          try {
            const runner = runPlanV6(
              {
                requirement: input.requirement,
                auto: input.auto,
                workspace: input.workspace,
                repoBase: input.repoBase,
                mode: input.mode,
                context: input.context,
              },
              { signal: abortController.signal }
            );

            await workflowRepo.createRun({
              id: runner.runId,
              userId: session.user.id,
              workflowId: "plan",
              status: "running",
              inputData: input,
            });

            runId = runner.runId;
            await runRegistry.register(runId, {
              resume: async ({ resumeData }) => {
                if (cancelled) return;
                await runner.resume(resumeData);
              },
              cancel: async () => {
                cancelled = true;
                abortController.abort();
              },
              abortController,
            });

            recordEvent("run");
            // Consume the generator, persisting each event then pushing to client
            for await (const event of runner.stream) {
              try {
                await workflowRepo.appendEvent({
                  runId,
                  eventType: event.type ?? "event",
                  eventData: event,
                });
              } catch {
                // persistence should not break streaming to client
              }
              push(event);
            }

            // Mark completion
            try {
              await workflowRepo.updateRun(runId, {
                status: "completed",
                completedAt: new Date(),
              });
            } catch {
              // ignore persistence errors on completion
            }

            recordEvent("complete");
            closeTimer("ok");
            emit.complete();
          } catch (error) {
            recordEvent("error");
            closeTimer("error");
            emit.error(toTRPCError(error, "workflow_error"));
          } finally {
            try {
              if (runId) {
                await runRegistry.unregister(runId);
              }
            } catch {
              // ignore unregister errors
            }
          }
        })();

        asyncTask.catch((error) => emit.error(toTRPCError(error)));

        return () => {
          cancelled = true;
          abortController.abort();
          if (!timerClosed) {
            recordEvent("cancel");
            closeTimer("cancel");
          }
        };
      })
    ),

  resume: authedProcedure
    .input(
      z.object({
        runId: z.string().min(1),
        event: z.enum(["deploy-authz", "linear-authz", "bio-authz"]),
        authz: z.string().min(1),
      })
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

  // Return durable run metadata
  get: authedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .query(async ({ input }) => {
      const run = await workflowRepo.getRun(input.runId);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
      }
      return run;
    }),

  // Return durable events for a run (newest first)
  events: authedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .query(async ({ input }) => {
      const events = await workflowRepo.listEvents(input.runId);
      return events;
    }),
});
