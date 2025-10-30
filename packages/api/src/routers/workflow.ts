import { mastra } from "@alfred/agent";
import type { WorkflowEvent } from "@alfred/type";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authedProcedure, router } from "../index";
import { requirePolicy } from "../gate";
import { MemoryRunRegistry } from "../run-registry";
import { cloneRuntimeContext } from "../context";
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
    attrs: { auto: input?.auto ?? "read", mode: input?.mode ?? "sequential" },
  };
};

function toTRPCError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }

  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "unknown_error";

  const make = (code: TRPCError["code"], msg: string) =>
    new TRPCError({
      code,
      message: msg,
      cause: error instanceof Error ? error : undefined,
    });

  if (message === "biometric_required") {
    return make("PRECONDITION_FAILED", message);
  }

  if (message === "droid_invalid_cwd" || message === "droid_invalid_cwd_not_directory") {
    return make("BAD_REQUEST", message);
  }

  if (message === "droid_binary_not_found") {
    return make("PRECONDITION_FAILED", message);
  }

  if (typeof message === "string" && message.startsWith("droid_exec_failed")) {
    return make("INTERNAL_SERVER_ERROR", message);
  }

  if (message === "docker_invalid_cwd" || message === "docker_invalid_cwd_not_directory") {
    return make("BAD_REQUEST", message);
  }

  if (message === "docker_binary_not_found") {
    return make("PRECONDITION_FAILED", message);
  }

  if (message === "docker_probe_url_required") {
    return make("BAD_REQUEST", message);
  }

  if (
    message === "docker_build_failed" ||
    message === "docker_run_failed" ||
    message === "docker_stop_failed" ||
    message === "docker_remove_failed" ||
    message === "docker_inspect_failed" ||
    message === "docker_logs_failed" ||
    message === "docker_wait_failed" ||
    message === "docker_probe_failed" ||
    message === "docker_probe_timeout"
  ) {
    return make("PRECONDITION_FAILED", message);
  }

  if (message === "preview_port_unavailable") {
    return make("PRECONDITION_FAILED", message);
  }

  if (message === "preview_host_port_missing" || message === "preview_upstream_unavailable") {
    return make("BAD_REQUEST", message);
  }

  if (message === "preview_unhealthy" || message === "promote_upstream_unhealthy") {
    return make("PRECONDITION_FAILED", message);
  }

  if (
    message === "ticket_activity_failed" ||
    message === "ticket_session_external_url_failed" ||
    message === "ticket_session_required"
  ) {
    return make("PRECONDITION_FAILED", message);
  }

  if (
    message === "ticket_team_required" ||
    message === "ticket_title_required" ||
    message === "ticket_issue_required" ||
    message === "ticket_comment_body_required" ||
    message === "ticket_activity_body_required" ||
    message === "ticket_activity_title_required" ||
    message === "ticket_external_url_required"
  ) {
    return make("BAD_REQUEST", message);
  }

  if (typeof message === "string" && message.startsWith("router_caddy_error:")) {
    const [, statusPart, detail = ""] = message.split(":", 3);
    const statusCode = Number.parseInt(statusPart ?? "", 10);
    if (Number.isFinite(statusCode)) {
      if (statusCode >= 500) {
        return make("INTERNAL_SERVER_ERROR", message);
      }
      return make("BAD_REQUEST", detail ? detail : message);
    }
    return make("BAD_REQUEST", message);
  }

  if (message === "web_fetch_url_required") {
    return make("BAD_REQUEST", message);
  }

  if (
    message === "web_fetch_unsupported_content_type" ||
    message === "web_serpapi_missing_key" ||
    message === "web_provider_tavily_unavailable"
  ) {
    return make("PRECONDITION_FAILED", message);
  }

  if (typeof message === "string" && message.startsWith("web_search_failed")) {
    return make("PRECONDITION_FAILED", message);
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "workflow_failed",
    cause: error instanceof Error ? error : undefined,
  });
}

// NOTE: MemoryRunRegistry only works when resumes hit the same instance.
// TODO(run-registry): Swap with Redis registry per docs/mastra/server/run-registry.md.
const runRegistry = new MemoryRunRegistry(); // Multi-instance deployments require sticky routing today.

export const workflowRouter: ReturnType<typeof router> = router({
  start: authedProcedure
    .use(
      requirePolicy("workflow.plan", (raw) => mapWorkflowResource(raw))
    )
    .input(workflowInput)
    .mutation(async ({ input, ctx }) => {
      const workflow = mastra.getWorkflow?.("plan") ?? null;
      if (!workflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "workflow_not_found",
        });
      }

      try {
        const session = ctx.session;
        if (!session) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "session_required" });
        }
        const obligations = Array.isArray(ctx.policy?.obligations) ? ctx.policy?.obligations : undefined;
        const payload = {
          ...input,
          userId: session.user.id,
          policyObligations: obligations,
        } as z.infer<typeof workflowInput>;
        const runtimeExtras: Array<[string, unknown]> = [
          ["workflowRequirement", input.requirement],
          ["workflowAuto", input.auto],
          ["workflowMode", input.mode],
        ];
        if (input.workspace) {
          runtimeExtras.push(["workflowWorkspace", input.workspace]);
        }
        if (input.repoBase) {
          runtimeExtras.push(["workflowRepoBase", input.repoBase]);
        }
        if (input.profile) {
          runtimeExtras.push(["workflowCodexProfile", input.profile]);
        }
        if (input.context?.enable !== undefined) {
          runtimeExtras.push(["workflowContextEnabled", input.context.enable]);
        }
        if (obligations && obligations.length > 0) {
          runtimeExtras.push(["workflowPolicyObligations", obligations]);
        }
        const runtimeContext = cloneRuntimeContext(ctx.runtimeContext, runtimeExtras);
        const run = await workflow.createRunAsync();
        const runId = (run as { id?: string }).id ?? null;
        if (runId) {
          runtimeContext.set("workflowRunId", runId);
        }
        const outcome = await run.start({
          inputData: payload,
          runtimeContext,
        });

        const output = "result" in outcome ? (outcome as { result?: unknown }).result : undefined;
        const summary = (output as { summary?: string })?.summary ?? "";
        const results = (output as { results?: unknown[] })?.results ?? [];
        const plan = (output as { plan?: unknown })?.plan ?? null;
        const vcs = (output as { vcs?: unknown })?.vcs ?? null;
        const report = (output as { report?: unknown })?.report ?? null;
        const planArtifact = (output as { planArtifact?: unknown })?.planArtifact ?? null;
        const ticketId = (output as { ticketId?: string })?.ticketId ?? null;
        const ticketUrl = (output as { ticketUrl?: string })?.ticketUrl ?? null;

        return {
          runId,
          summary,
          results,
          plan,
          vcs,
          report,
          planArtifact,
          ticketId,
          ticketUrl,
        };
      } catch (error) {
        throw toTRPCError(error);
      }
    }),

  stream: authedProcedure
    .use(
      requirePolicy("workflow.plan", (raw) => mapWorkflowResource(raw))
    )
    .input(workflowInput)
    .subscription(({ input, ctx }) =>
      observable<WorkflowEvent>(emit => {
        let cancelled = false;
        let runMeta:
          | {
              run: { cancel(): Promise<void>; abortController: AbortController; resume?: (args: any) => Promise<any> };
              runId: string;
            }
          | null = null;
        const stopStreamTimer = workflowStreamDurationSeconds.startTimer();
        let timerClosed = false;
        const closeTimer = (status: "ok" | "error" | "cancel") => {
          if (timerClosed) return;
          stopStreamTimer({ status });
          timerClosed = true;
        };
        const recordEvent = (event: "run" | "progress" | "chunk" | "complete" | "error" | "cancel") => {
          workflowStreamEventsTotal.inc({ event });
        };

        (async () => {
          const workflow = mastra.getWorkflow?.("plan") ?? null;
          if (!workflow) {
            recordEvent("error");
            closeTimer("error");
            emit.error(
              new TRPCError({
                code: "NOT_FOUND",
                message: "workflow_not_found",
              }),
            );
            return;
          }

          const session = ctx.session;
          if (!session) {
            recordEvent("error");
            closeTimer("error");
            emit.error(new TRPCError({ code: "UNAUTHORIZED", message: "session_required" }));
            return;
          }
          const obligations = Array.isArray(ctx.policy?.obligations) ? ctx.policy?.obligations : undefined;
          const payload = {
            ...input,
            userId: session.user.id,
            policyObligations: obligations,
          } as z.infer<typeof workflowInput>;
          const runtimeExtras: Array<[string, unknown]> = [
            ["workflowRequirement", input.requirement],
            ["workflowAuto", input.auto],
            ["workflowMode", input.mode],
            ["workflowStream", true],
          ];
          if (input.workspace) {
            runtimeExtras.push(["workflowWorkspace", input.workspace]);
          }
          if (input.repoBase) {
            runtimeExtras.push(["workflowRepoBase", input.repoBase]);
          }
          if (input.profile) {
            runtimeExtras.push(["workflowCodexProfile", input.profile]);
          }
          if (input.context?.enable !== undefined) {
            runtimeExtras.push(["workflowContextEnabled", input.context.enable]);
          }
          if (obligations && obligations.length > 0) {
            runtimeExtras.push(["workflowPolicyObligations", obligations]);
          }
          const runtimeContext = cloneRuntimeContext(ctx.runtimeContext, runtimeExtras);

          const workflowRun = await workflow.createRunAsync();
          const runId = (workflowRun as { id?: string }).id ?? randomUUID();
          runtimeContext.set("workflowRunId", runId);
          runMeta = { run: workflowRun, runId };
          const resume = workflowRun.resume?.bind(workflowRun);
          const cancel = workflowRun.cancel?.bind(workflowRun);
          if (!resume || !cancel) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "workflow_resume_unsupported",
            });
          }
          runRegistry.register(runId, {
            resume: async args => {
              await resume({
                ...args,
                runtimeContext,
              });
            },
            cancel,
            abortController: workflowRun.abortController,
          });
          recordEvent("run");
          emit.next({ type: "run", id: runId } as unknown as WorkflowEvent);

          const stream = await workflowRun.streamVNext({
            inputData: payload,
            runtimeContext,
          });

          try {
            for await (const chunk of stream) {
              if (cancelled) break;
              recordEvent("chunk");
              emit.next(chunk as unknown as WorkflowEvent);
            }
            if (!cancelled) {
              recordEvent("progress");
              emit.next({ type: "progress", pct: 100, message: "workflow_completed" });
              recordEvent("complete");
              closeTimer("ok");
              emit.complete();
            }
          } catch (error) {
            recordEvent("error");
            closeTimer("error");
            emit.error(toTRPCError(error));
          } finally {
            if (runMeta) {
              runRegistry.unregister(runMeta.runId);
            }
          }
        })().catch(error => emit.error(toTRPCError(error)));

        return () => {
          cancelled = true;
          if (runMeta) {
            void runMeta.run.cancel().catch(() => {
              // best-effort cleanup; ignore further errors during teardown
            });
            runMeta.run.abortController.abort();
            runRegistry.unregister(runMeta.runId);
          }
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
