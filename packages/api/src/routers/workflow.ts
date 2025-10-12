import { mastra } from "@alfred/agent";
import type { WorkflowEvent } from "@alfred/type";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { authedProcedure, router } from "../index";
import { requirePolicy } from "../gate";

const workflowInput = z.object({
  requirement: z.string().min(1),
  auto: z.enum(["read", "low", "medium", "high"]).default("low"),
  authz: z.string().optional(),
  cw: z.string().optional(),
  mode: z.enum(["sequential", "parallel"]).default("sequential"),
  workspace: z.string().optional(),
  repoBase: z.string().optional(),
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

  if (message === "biometric_required") {
    return new TRPCError({
      code: "PRECONDITION_FAILED",
      message,
      cause: error instanceof Error ? error : undefined,
    });
  }

  if (message === "droid_invalid_cwd" || message === "droid_invalid_cwd_not_directory") {
    return new TRPCError({
      code: "BAD_REQUEST",
      message,
      cause: error instanceof Error ? error : undefined,
    });
  }

  if (message === "droid_binary_not_found") {
    return new TRPCError({
      code: "PRECONDITION_FAILED",
      message,
      cause: error instanceof Error ? error : undefined,
    });
  }

  if (typeof message === "string" && message.startsWith("droid_exec_failed")) {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message,
      cause: error instanceof Error ? error : undefined,
    });
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "workflow_failed",
    cause: error instanceof Error ? error : undefined,
  });
}

export const workflowRouter: ReturnType<typeof router> = router({
  start: authedProcedure
    .use(
      requirePolicy("workflow.plan", (raw) => mapWorkflowResource(raw))
    )
    .input(workflowInput)
    .mutation(async ({ input }) => {
      const workflow = mastra.getWorkflow?.("plan") ?? null;
      if (!workflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "workflow_not_found",
        });
      }

      try {
        const run = await workflow.createRunAsync();
        const outcome = await run.start({
          inputData: input,
        });

        const output = "result" in outcome ? (outcome as { result?: unknown }).result : undefined;
        const summary = (output as { summary?: string })?.summary ?? "";
        const results = (output as { results?: unknown[] })?.results ?? [];
        const plan = (output as { plan?: unknown })?.plan ?? null;
        const vcs = (output as { vcs?: unknown })?.vcs ?? null;

        return {
          runId: (run as { id?: string }).id ?? null,
          summary,
          results,
          plan,
          vcs,
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
    .subscription(({ input }) =>
      observable<WorkflowEvent>(emit => {
        let cancelled = false;
        let run: { cancel(): Promise<void>; abortController: AbortController } | null = null;

        (async () => {
          const workflow = mastra.getWorkflow?.("plan") ?? null;
          if (!workflow) {
            emit.error(
              new TRPCError({
                code: "NOT_FOUND",
                message: "workflow_not_found",
              }),
            );
            return;
          }

          const workflowRun = await workflow.createRunAsync();
          run = workflowRun;
          const stream = await workflowRun.streamVNext({
            inputData: input,
          });

          try {
            for await (const chunk of stream) {
              if (cancelled) break;
              emit.next(chunk as unknown as WorkflowEvent);
            }
            if (!cancelled) {
              emit.next({ type: "progress", pct: 100, message: "workflow_completed" });
              emit.complete();
            }
          } catch (error) {
            emit.error(toTRPCError(error));
          }
        })().catch(error => emit.error(toTRPCError(error)));

        return () => {
          cancelled = true;
          if (run) {
            void run.cancel().catch(() => {
              // best-effort cleanup; ignore further errors during teardown
            });
            run.abortController.abort();
          }
        };
      }),
    ),
});
