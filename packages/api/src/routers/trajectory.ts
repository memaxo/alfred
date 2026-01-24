import * as trajectoryRepo from "@alfred/db/repo/trajectory";
import * as workflowRepo from "@alfred/db/repo/workflow";
import { type WorkflowTrajectoryFormat } from "@alfred/db/schema/workflow";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";

const formatSchema = z.literal("atif");

interface ValidationErr {
  path: string;
  message: string;
}

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
  return { attrs: { scope: "self" }, id, kind: "workflow.run" as const };
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
  const { buildAtifTrajectory } =
    await import("@alfred/runtime/trajectory/atif");
  const { validateAtifTrajectory } =
    await import("@alfred/runtime/trajectory/validate");

  const trajectory = buildAtifTrajectory({
    events: rawEvents.map((e) => ({
      eventId: e.eventId,
      eventType: e.eventType,
      eventData: e.eventData,
      timestamp: e.timestamp ?? null,
      seq: e.seq ?? null,
    })),
    requirement: typeof run.requirement === "string" ? run.requirement : null,
    runId: args.runId,
  });

  const validation = validateAtifTrajectory(trajectory);

  const stored = await trajectoryRepo.upsertTrajectory({
    data: trajectory,
    errors: validation.ok ? null : validation.errors,
    format: args.format,
    lastEventId,
    lastSeq,
    runId: args.runId,
    schemaVersion: trajectory.schema_version,
    valid: validation.ok,
  });

  return {
    lastEventId: stored.lastEventId,
    lastSeq: stored.lastSeq,
    schemaVersion: stored.schemaVersion,
    storedAt: stored.updatedAt,
    trajectory: stored.data,
    validation,
  };
}

export const trajectoryRouter = router({
  get: authedProcedure
    .use(
      requirePolicy("workflow.read", (raw) => mapWorkflowRunResourceLocal(raw))
    )
    .input(
      z.object({
        format: formatSchema.optional().default("atif"),
        runId: z.string().uuid(),
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

      const { format } = input;
      const marker = await trajectoryRepo.getRunEventMarker(input.runId);
      const existing = await trajectoryRepo.getTrajectoryByRunId({
        format,
        runId: input.runId,
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
          lastEventId: existing.lastEventId,
          lastSeq: existing.lastSeq,
          schemaVersion: existing.schemaVersion,
          storedAt: existing.updatedAt,
          trajectory: existing.data,
          validation: { ok: existing.valid, errors },
        };
      }

      return buildAndPersistAtif({ format: "atif", runId: input.runId });
    }),

  refresh: authedProcedure
    .use(
      requirePolicy("workflow.read", (raw) => mapWorkflowRunResourceLocal(raw))
    )
    .input(
      z.object({
        format: formatSchema.optional().default("atif"),
        runId: z.string().uuid(),
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

      return buildAndPersistAtif({ format: "atif", runId: input.runId });
    }),
});
