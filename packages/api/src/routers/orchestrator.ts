import * as workflowRepo from "@alfred/db/repo/workflow";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requirePolicy } from "../gate";
import {
  orchestratorGenerateDurationSeconds,
  orchestratorGenerateRequestsTotal,
} from "../metrics";
import { authedProcedure, rateLimit, router } from "../trpc";
import { toTRPCError } from "../utils/error";

const ORCHESTRATOR_MAX_STEPS = 12;

const generateInput = z.object({
  projectId: z.string().uuid().optional(),
  thread: z.string().optional(),
  resource: z.string().optional(),
  messages: z.array(z.unknown()).min(1),
  toolChoice: z.enum(["auto", "none", "required"]).optional(),
  maxSteps: z.number().int().min(1).max(ORCHESTRATOR_MAX_STEPS).optional(),
  memory: z.unknown().optional(),
});

function mapResource(raw: unknown) {
  const input = (raw ?? {}) as z.infer<typeof generateInput> & {
    requirement?: string;
  };
  return {
    kind: "orchestrator" as const,
    id: input.thread ?? input.resource ?? "default",
    attrs: {
      scope: input.resource ?? "self",
    },
  };
}

export const orchestratorRouter = router({
  generate: authedProcedure
    .use(rateLimit)
    .use(requirePolicy("orchestrator.generate", (raw) => mapResource(raw)))
    .input(generateInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      const stopTimer = orchestratorGenerateDurationSeconds.startTimer();
      orchestratorGenerateRequestsTotal.inc({ status: "started" });
      try {
        const { generateOrchestratorText } = await import(
          "../services/orchestrator"
        );
        const result = await generateOrchestratorText({
          userId: ctx.session.user.id,
          projectId: input.projectId,
          messages: input.messages,
          toolChoice: input.toolChoice,
          maxSteps: input.maxSteps,
        });
        orchestratorGenerateRequestsTotal.inc({ status: "success" });
        stopTimer({ status: "success" });
        return result;
      } catch (error) {
        orchestratorGenerateRequestsTotal.inc({ status: "error" });
        stopTimer({ status: "error" });
        throw toTRPCError(error, "orchestrator_error");
      }
    }),
  stream: authedProcedure
    // Streaming moved to HTTP SSE to keep a single transport.
    .input(z.object({}).passthrough())
    .subscription(() => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message:
          "orchestrator.stream has moved to the HTTP SSE endpoint at /api/orchestrator.",
      });
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // Runs Management Procedures
  // ─────────────────────────────────────────────────────────────────────────

  runsList: authedProcedure
    .input(
      z.object({
        status: z
          .enum(["running", "suspended", "completed", "failed", "cancelled"])
          .optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      const { listRunsWithDetails } = await import(
        "../services/orchestrator-runs"
      );
      return await listRunsWithDetails({
        userId: ctx.session.user.id,
        status: input.status,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  runsGet: authedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      const { getRunWithDetails } = await import(
        "../services/orchestrator-runs"
      );
      return await getRunWithDetails({
        runId: input.runId,
        userId: ctx.session.user.id,
      });
    }),

  runsPause: authedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      const run = await workflowRepo.getRun(input.runId);
      if (!run || run.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
      }
      if (run.status !== "running") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "run_not_running",
        });
      }
      await workflowRepo.updateRun(input.runId, {
        status: "suspended",
        suspendedAt: new Date(),
      });
      return { success: true };
    }),

  runsResume: authedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      const run = await workflowRepo.getRun(input.runId);
      if (!run || run.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
      }
      if (run.status !== "suspended") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "run_not_suspended",
        });
      }
      await workflowRepo.updateRun(input.runId, {
        status: "running",
        resumedAt: new Date(),
      });
      return { success: true };
    }),

  runsCancel: authedProcedure
    .input(z.object({ runId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      const run = await workflowRepo.getRun(input.runId);
      if (!run || run.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
      }
      if (run.status === "completed" || run.status === "cancelled") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "run_already_finished",
        });
      }
      await workflowRepo.updateRun(input.runId, {
        status: "cancelled",
        completedAt: new Date(),
      });
      return { success: true };
    }),

  logsStream: authedProcedure
    .input(
      z.object({
        runId: z.string().min(1),
        agentId: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      const { streamRunLogs } = await import("../services/orchestrator-runs");
      return await streamRunLogs({
        runId: input.runId,
        userId: ctx.session.user.id,
        agentId: input.agentId,
        limit: input.limit,
      });
    }),
});
