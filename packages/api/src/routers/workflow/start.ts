import { ensureMirrorNodes } from "@alfred/db/repo/graph/write";
import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";
import { TRPCError } from "@trpc/server";
import { PolicyObligationError } from "../../errors";
import { requirePolicy } from "../../gate";
import { triggerPreferenceRefresh } from "../../preference/refresh";
import { authedProcedure, rateLimit } from "../../trpc";
import { toTRPCError } from "../../utils/error";
import { initWorkflowMetrics } from "../../workflow/metrics";
import { requiresBiometric } from "../../workflow/obligation";
import { mapWorkflowResourceLocal } from "../../workflow/resource";
import { workflowInputSchema } from "../../workflow/input";

export const workflowStartProcedure = authedProcedure
  .use(rateLimit)
  .use(requirePolicy("workflow.plan", (raw) => mapWorkflowResourceLocal(raw)))
  .input(workflowInputSchema)
  .mutation(async ({ input, ctx }) => {
    const session = ctx.session;
    if (!session?.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }

    await initWorkflowMetrics();
    const { workflowInput } = await import("@alfred/agent/workflow/schema");
    const workflow = workflowInput.parse(input);

    // Enforce obligations for medium/high autonomy workflows
    if (workflow.auto === "medium" || workflow.auto === "high") {
      const obligations = ctx.policy?.obligations ?? [];
      if (obligations.length > 0 && requiresBiometric(obligations)) {
        throw new PolicyObligationError("workflow.plan", obligations, {
          reason: "workflow_autonomy",
          auto: workflow.auto,
        });
      }
    }

    try {
      const [
        { ensureLinearTicket },
        {
          createRequirementMessage,
          createWorkflowExecutor,
          deriveWorkflowTitle,
          ensureWorkflowConversation,
          persistWorkflowMessages,
        },
        { recordAudit },
        { registerRunHandle },
      ] = await Promise.all([
        import("@alfred/agent/workflow/linear"),
        import("@alfred/agent/workflow/services"),
        import("@alfred/agent/utils/audit"),
        import("@alfred/agent/workflow/session-recovery"),
      ]);

      const abortController = new AbortController();
      const { linear: preparedLinear, ticket } = await ensureLinearTicket({
        linear: workflow.linear,
        authzLinear: workflow.authzLinear,
        requirement: workflow.requirement,
      });
      const workflowPayload = {
        ...workflow,
        linear: preparedLinear,
      };

      const executor = await createWorkflowExecutor(
        workflowPayload,
        abortController,
        undefined,
        ctx.runtimeContext
      );

      const storedInput: Record<string, unknown> = {
        ...workflowPayload,
        executionId: executor.runId,
        reasoningSince: Date.now(),
      };
      const linearIssueId =
        preparedLinear?.issueId ?? preparedLinear?.sessionId ?? undefined;
      const linearIssueUrl = ticket?.issueUrl ?? preparedLinear?.issueUrl ?? undefined;

      await workflowRepo.createRun({
        id: executor.runId,
        userId: session.user.id,
        projectId: workflow.projectId,
        planId: workflow.planId,
        requirement: workflow.requirement,
        workflowId: "plan",
        status: "running",
        inputData: storedInput,
        linearSessionId: preparedLinear?.sessionId,
        linearSpace: preparedLinear?.space,
        linearIssueId,
        linearIssueUrl,
      });

      // Trigger Linear metadata sync if project is associated
      if (workflow.projectId) {
        const projectId = workflow.projectId;
        void (async () => {
          const url = process.env.DATABASE_URL;
          if (url && !url.startsWith("sqlite")) {
            await import("@alfred/db/repo/project")
              .then((repo) => repo.updateProjectLastActive(projectId))
              .catch(() => {});
          }
          const { syncOnWorkflowStart } = await import("@alfred/plan");
          await syncOnWorkflowStart(projectId as string, executor.runId);
        })();
      }

      await ensureMirrorNodes(
        "user",
        [
          {
            kind: "workflow_run",
            id: executor.runId,
            label: deriveWorkflowTitle(workflowPayload.requirement),
            properties: {
              entity: { kind: "workflow_run", id: executor.runId },
              workflowId: "plan",
              status: "running",
              linearIssueId,
              linearIssueUrl,
            },
          },
        ],
        { projectId: workflow.projectId ?? undefined }
      );

      try {
        const { conversation, created } = await ensureWorkflowConversation({
          userId: session.user.id,
          workflowId: executor.runId,
          title: deriveWorkflowTitle(workflowPayload.requirement),
          projectId: workflow.projectId,
        });
        if (created) {
          const persisted = await persistWorkflowMessages({
            userId: session.user.id,
            conversationId: conversation.id,
            messages: [createRequirementMessage(workflowPayload, executor.runId)],
            persistedKeys: new Set(),
            runId: executor.runId,
            eventType: "workflow.requirement",
            eventId: executor.runId,
          });
          if (persisted > 0) {
            triggerPreferenceRefresh(session.user.id, {
              reason: "workflow_requirement",
            });
          }
        }
      } catch (error) {
        logger.warn("workflow_conversation_init_failed", {
          runId: executor.runId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await recordAudit({
        userId: session.user.id,
        projectId: workflow.projectId ?? undefined,
        action: "workflow.start",
        resource: { kind: "workflow", id: executor.runId },
        decision: "allow",
        context: { auto: workflow.auto, mode: workflow.mode },
      });

      await registerRunHandle(executor.runId, {
        resume: async ({ resumeData }: { resumeData: unknown }) => {
          await executor.resume(resumeData);
        },
        // biome-ignore lint/suspicious/useAwait: Cancel is synchronous or returns a promise
        cancel: async () => {
          executor.cancel();
        },
        abortController,
      });

      return {
        runId: executor.runId,
        summary: executor.summary,
        results: [],
        plan: null,
        vcs: null,
        report: null,
        planArtifact: null,
        ticketId: linearIssueId,
        ticketUrl: linearIssueUrl,
      };
    } catch (error) {
      throw toTRPCError(error, "workflow_start_failed");
    }
  });

