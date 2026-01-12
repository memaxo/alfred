import * as trajectoryRepo from "@alfred/db/repo/trajectory";
import * as workflowRepo from "@alfred/db/repo/workflow";
import type { WorkflowTrajectoryFormat } from "@alfred/db/schema/workflow";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";

const formatSchema = z.literal("atif");

type ValidationErr = { path: string; message: string };

function isValidationErrArray(val: unknown): val is ValidationErr[] {
  if (!Array.isArray(val)) {
    return false;
  }
  return val.every((v) => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
      return false;
    }
    const r = v as Record<string, unknown>;
    return typeof r.path === "string" && typeof r.message === "string";
  });
}

function mapWorkflowRunResourceLocal(raw: unknown) {
  const input =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const id =
    typeof input.runId === "string" && input.runId.length > 0
      ? input.runId
      : "unknown";
  return { kind: "workflow.run" as const, id, attrs: { scope: "self" } };
}

async function buildAndPersistAtif(args: { runId: string; format: "atif" }) {
  const run = await workflowRepo.getRun(args.runId);
  if (!run) {
    throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
  }

  const { lastEventId, lastSeq } = await trajectoryRepo.getRunEventMarker(
    args.runId
  );

  const rawEvents = await workflowRepo.listEvents(args.runId);
  const { buildAtifTrajectory } = await import(
    "@alfred/runtime/trajectory/atif"
  );
  const { validateAtifTrajectory } = await import(
    "@alfred/runtime/trajectory/validate"
  );

  const trajectory = buildAtifTrajectory({
    runId: args.runId,
    requirement: typeof run.requirement === "string" ? run.requirement : null,
    events: rawEvents.map((e) => ({
      eventId: e.eventId,
      eventType: e.eventType,
      eventData: e.eventData,
      timestamp: e.timestamp ?? null,
      seq: e.seq ?? null,
    })),
  });

  const validation = validateAtifTrajectory(trajectory);

  const stored = await trajectoryRepo.upsertTrajectory({
    runId: args.runId,
    format: args.format,
    schemaVersion: trajectory.schema_version,
    data: trajectory,
    lastEventId,
    lastSeq,
    valid: validation.ok,
    errors: validation.ok ? null : validation.errors,
  });

  return {
    schemaVersion: stored.schemaVersion,
    trajectory: stored.data,
    validation,
    storedAt: stored.updatedAt,
    lastSeq: stored.lastSeq,
    lastEventId: stored.lastEventId,
  };
}

export const trajectoryRouter = router({
  get: authedProcedure
    .use(
      requirePolicy("workflow.read", (raw) => mapWorkflowRunResourceLocal(raw))
    )
    .input(
      z.object({
        runId: z.string().uuid(),
        format: formatSchema.optional().default("atif"),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const run = await workflowRepo.getRun(input.runId);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
      }
      if (run.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "access_denied" });
      }

      const format: WorkflowTrajectoryFormat = input.format;
      const marker = await trajectoryRepo.getRunEventMarker(input.runId);
      const existing = await trajectoryRepo.getTrajectoryByRunId({
        runId: input.runId,
        format,
      });

      const isFresh =
        existing &&
        (existing.lastEventId ?? null) === marker.lastEventId &&
        (existing.lastSeq ?? null) === marker.lastSeq;

      if (isFresh) {
        const errors = isValidationErrArray(existing.errors)
          ? existing.errors
          : [];
        return {
          schemaVersion: existing.schemaVersion,
          trajectory: existing.data,
          validation: { ok: existing.valid, errors },
          storedAt: existing.updatedAt,
          lastSeq: existing.lastSeq,
          lastEventId: existing.lastEventId,
        };
      }

      return buildAndPersistAtif({ runId: input.runId, format: "atif" });
    }),

  refresh: authedProcedure
    .use(
      requirePolicy("workflow.read", (raw) => mapWorkflowRunResourceLocal(raw))
    )
    .input(
      z.object({
        runId: z.string().uuid(),
        format: formatSchema.optional().default("atif"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const run = await workflowRepo.getRun(input.runId);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
      }
      if (run.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "access_denied" });
      }

      return buildAndPersistAtif({ runId: input.runId, format: "atif" });
    }),
});
