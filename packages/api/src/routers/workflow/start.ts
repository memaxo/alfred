import { ensureMirrorNodes } from "@alfred/db/repo/graph/write";
import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";
import { TRPCError } from "@trpc/server";

import { PolicyObligationError } from "../../errors";
import { requirePolicy } from "../../gate";
import { triggerPreferenceRefresh } from "../../preference/refresh";
import { authedProcedure, rateLimit } from "../../trpc";
import { toTRPCError } from "../../utils/error";
import { workflowInputSchema } from "../../workflow/input";
import { initWorkflowMetrics } from "../../workflow/metrics";
import { requiresBiometric } from "../../workflow/obligation";
import { mapWorkflowResourceLocal } from "../../workflow/resource";

export const workflowStartProcedure = authedProcedure
  .use(rateLimit)
  .use(requirePolicy("workflow.plan", (raw) => mapWorkflowResourceLocal(raw)))
  .input(workflowInputSchema)
  .mutation(async ({ input, ctx }) => {
    const { session } = ctx;
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
          auto: workflow.auto,
          reason: "workflow_autonomy",
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
        authzLinear: workflow.authzLinear,
        linear: workflow.linear,
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
      const linearIssueUrl =
        ticket?.issueUrl ?? preparedLinear?.issueUrl ?? undefined;

      await workflowRepo.createRun({
        id: executor.runId,
        inputData: storedInput,
        linearIssueId,
        linearIssueUrl,
        linearSessionId: preparedLinear?.sessionId,
        linearSpace: preparedLinear?.space,
        planId: workflow.planId,
        projectId: workflow.projectId,
        requirement: workflow.requirement,
        status: "running",
        userId: session.user.id,
        workflowId: "plan",
      });

      // Trigger Linear metadata sync if project is associated
      if (workflow.projectId) {
        const { projectId } = workflow;
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
            id: executor.runId,
            kind: "workflow_run",
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
          projectId: workflow.projectId,
          title: deriveWorkflowTitle(workflowPayload.requirement),
          userId: session.user.id,
          workflowId: executor.runId,
        });
        if (created) {
          const persisted = await persistWorkflowMessages({
            conversationId: conversation.id,
            eventId: executor.runId,
            eventType: "workflow.requirement",
            messages: [
              createRequirementMessage(workflowPayload, executor.runId),
            ],
            persistedKeys: new Set(),
            runId: executor.runId,
            userId: session.user.id,
          });
          if (persisted > 0) {
            triggerPreferenceRefresh(session.user.id, {
              reason: "workflow_requirement",
            });
          }
        }
      } catch (error) {
        logger.warn("workflow_conversation_init_failed", {
          error: error instanceof Error ? error.message : String(error),
          runId: executor.runId,
        });
      }

      await recordAudit({
        action: "workflow.start",
        context: { auto: workflow.auto, mode: workflow.mode },
        decision: "allow",
        projectId: workflow.projectId ?? undefined,
        resource: { kind: "workflow", id: executor.runId },
        userId: session.user.id,
      });

      await registerRunHandle(executor.runId, {
        resume: async ({ resumeData }: { resumeData: unknown }) => {
          await executor.resume(resumeData);
        },
        // oxlint-disable useAwait: Cancel is synchronous or returns a promise
        cancel: async () => {
          executor.cancel();
        },
        abortController,
      });

      return {
        plan: null,
        planArtifact: null,
        report: null,
        results: [],
        runId: executor.runId,
        summary: executor.summary,
        ticketId: linearIssueId,
        ticketUrl: linearIssueUrl,
        vcs: null,
      };
    } catch (error) {
      throw toTRPCError(error, "workflow_start_failed");
    }
  });
