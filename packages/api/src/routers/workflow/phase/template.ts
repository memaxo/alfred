import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requirePolicy } from "../../../gate";
import { authedProcedure, rateLimit } from "../../../trpc";
import { toTRPCError } from "../../../utils/error";
import { WorkflowCheckpointStorage } from "../../../workflow/checkpoint";
import { mapWorkflowResourceLocal } from "../../../workflow/resource";

export const workflowPhaseSaveAsTemplateProcedure = authedProcedure
  .use(rateLimit)
  .use(requirePolicy("workflow.plan", (raw) => mapWorkflowResourceLocal(raw)))
  .input(
    z.object({
      runId: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      triggerPattern: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const session = ctx.session;
    if (!session?.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }

    try {
      const [{ PostgresCheckpointStorage }, { templateRepo }] =
        await Promise.all([
          import("@alfred/db/repo/workflow"),
          import("@alfred/db"),
        ]);

      const storage = new WorkflowCheckpointStorage(
        new PostgresCheckpointStorage()
      );
      const snapshot = await storage.load(input.runId);

      if (!snapshot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "snapshot_not_found",
        });
      }

      const ctxMap = new Map(snapshot.contextEntries ?? []);
      const planOutput = ctxMap.get("planOutput");

      if (!planOutput) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "plan_not_found_in_snapshot",
        });
      }

      const templateId = await templateRepo.saveTemplate(
        session.user.id,
        input.name,
        planOutput,
        {
          description: input.description,
          triggerPattern: input.triggerPattern,
        }
      );

      return { templateId };
    } catch (error) {
      throw toTRPCError(error, "workflow_save_template_failed");
    }
  });

export const workflowPhaseListTemplatesProcedure = authedProcedure
  .use(requirePolicy("workflow.plan", (raw) => mapWorkflowResourceLocal(raw)))
  .query(async ({ ctx }) => {
    const session = ctx.session;
    if (!session?.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }

    try {
      const { templateRepo } = await import("@alfred/db");
      const templates = await templateRepo.listTemplates(session.user.id);

      return templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        triggerPattern: t.triggerPattern,
        successRate: t.successRate ? Number.parseFloat(t.successRate) : null,
        usageCount: typeof t.usageCount === "number" ? t.usageCount : 0,
        lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
        createdAt: t.createdAt?.toISOString() ?? new Date().toISOString(),
      }));
    } catch (error) {
      throw toTRPCError(error, "workflow_list_templates_failed");
    }
  });

export const workflowPhaseApplyTemplateProcedure = authedProcedure
  .use(rateLimit)
  .use(requirePolicy("workflow.plan", (raw) => mapWorkflowResourceLocal(raw)))
  .input(
    z.object({
      templateId: z.string().min(1),
      requirement: z.string().min(1),
      workspace: z.string().min(1),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const { templateRepo } = await import("@alfred/db");

      const planData = await templateRepo.applyTemplate(
        input.templateId,
        input.requirement
      );

      // Return as a structured plan that can be used for execution
      return {
        templateId: input.templateId,
        planData,
      };
    } catch (error) {
      throw toTRPCError(error, "workflow_apply_template_failed");
    }
  });
