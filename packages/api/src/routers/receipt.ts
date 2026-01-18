import {
  getBundleByCapture,
  getInboxItem,
  getReceiptByCapture,
  getWorkingSet,
  upsertReceipt,
} from "@alfred/db/repo/sense";
import { appendCorrection, scoreRoute } from "@alfred/sense";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";
import { publishInboxEvent } from "./inbox";

const getInput = z.object({ captureId: z.string().uuid() });

const outcomeInput = z.object({
  kind: z.enum(["inbox", "note", "reminder", "task"]),
  targetId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
});

const correctInput = z.object({
  captureId: z.string().uuid(),
  outcome: outcomeInput,
  note: z.string().min(1).max(400).optional(),
});

export const receiptRouter = router({
  get: authedProcedure.input(getInput).query(({ ctx, input }) => {
    const session = ctx.session;
    if (!session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }
    return getReceiptByCapture({
      userId: session.user.id,
      captureId: input.captureId,
    });
  }),

  correct: authedProcedure
    .input(correctInput)
    .mutation(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const bundle = await getBundleByCapture({
        userId: session.user.id,
        captureId: input.captureId,
      });
      if (!bundle) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "capture_bundle_not_found",
        });
      }

      const workingSet = await getWorkingSet(session.user.id);
      const base = scoreRoute({ text: bundle.text, workingSet });
      const existing =
        (await getReceiptByCapture({
          userId: session.user.id,
          captureId: input.captureId,
        })) ?? null;

      const correction = {
        correctedAt: new Date(),
        outcome: input.outcome,
        note: input.note,
      };

      const nextCorrections = appendCorrection({
        corrections: existing?.corrections ?? [],
        correction,
      });

      const receipt = await upsertReceipt({
        captureId: input.captureId,
        decision: existing?.decision ?? "route",
        summary: existing?.summary ?? base.summary,
        evidence: existing?.evidence ?? base.evidence,
        outcome: input.outcome,
        alternatives: existing?.alternatives ?? base.alternatives,
        confidence: existing?.confidence ?? base.confidence,
        corrections: nextCorrections,
      });

      const item = await getInboxItem({
        userId: session.user.id,
        captureId: input.captureId,
      });
      if (item) {
        publishInboxEvent(session.user.id, {
          type: "inbox.updated",
          payload: { item },
        });
      }

      return receipt;
    }),
});
