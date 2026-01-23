import { focusRepo } from "@alfred/db";
import { z } from "zod";
import { authedProcedure, rateLimit, router } from "../trpc";
import { assertResourceAccess } from "../utils/error-helpers";
import { optionalNullableDateSchema } from "../utils/zod-schemas";

const focusSetStatusSchema = z.enum(["active", "closed"]);
const focusLaneSchema = z.enum(["spotlight", "background", "maintenance"]);
const focusCommitmentStatusSchema = z.enum([
  "active",
  "paused",
  "done",
  "cancelled",
]);

export const focusRouter = router({
  list: authedProcedure
    .use(rateLimit)
    .input(
      z
        .object({
          status: focusSetStatusSchema.optional(),
          limit: z.number().int().min(1).max(100).default(20),
          offset: z.number().int().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const status = input?.status;
      return focusRepo.listFocusSets({
        userId,
        status,
        limit: input?.limit,
        offset: input?.offset,
      });
    }),

  active: authedProcedure.use(rateLimit).query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const rows = await focusRepo.listFocusSets({
      userId,
      status: "active",
      limit: 1,
      offset: 0,
    });
    return rows[0] ?? null;
  }),

  create: authedProcedure
    .use(rateLimit)
    .input(
      z.object({
        title: z.string().min(1).max(200).optional(),
        wipLimit: z.number().int().min(1).max(20).optional(),
        startsAt: z.string().datetime().optional(),
        endsAt: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      return focusRepo.createFocusSet({
        userId,
        title: input.title ?? null,
        wipLimit: input.wipLimit ?? 5,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        lastTouchedAt: new Date(),
        status: "active",
      });
    }),

  update: authedProcedure
    .use(rateLimit)
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200).nullable().optional(),
        wipLimit: z.number().int().min(1).max(20).optional(),
        status: focusSetStatusSchema.optional(),
        startsAt: optionalNullableDateSchema,
        endsAt: optionalNullableDateSchema,
        lastTouchedAt: optionalNullableDateSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const existing = await focusRepo.getFocusSetById(input.id);
      assertResourceAccess(existing, userId, "focus_set");

      return focusRepo.updateFocusSet(input.id, {
        title: input.title ?? undefined,
        wipLimit: input.wipLimit ?? undefined,
        status: input.status ?? undefined,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        lastTouchedAt: input.lastTouchedAt,
      });
    }),

  touch: authedProcedure
    .use(rateLimit)
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const existing = await focusRepo.getFocusSetById(input.id);
      assertResourceAccess(existing, userId, "focus_set");
      await focusRepo.touchFocusSet(input.id);
      return { ok: true };
    }),

  commitmentList: authedProcedure
    .use(rateLimit)
    .input(
      z
        .object({
          focusSetId: z.string().uuid().optional(),
          status: focusCommitmentStatusSchema.optional(),
          lane: focusLaneSchema.optional(),
          limit: z.number().int().min(1).max(200).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      return focusRepo.listCommitments({
        userId,
        focusSetId: input?.focusSetId,
        status: input?.status,
        lane: input?.lane,
        limit: input?.limit,
        offset: input?.offset,
      });
    }),

  commitmentCreate: authedProcedure
    .use(rateLimit)
    .input(
      z.object({
        focusSetId: z.string().uuid(),
        title: z.string().min(1).max(240),
        lane: focusLaneSchema.optional(),
        priority: z.number().int().min(0).max(10_000).optional(),
        workflowRunId: z.string().uuid().nullable().optional(),
        conversationId: z.string().uuid().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const set = await focusRepo.getFocusSetById(input.focusSetId);
      assertResourceAccess(set, userId, "focus_set");

      return focusRepo.createCommitment({
        userId,
        focusSetId: input.focusSetId,
        title: input.title,
        lane: input.lane ?? "background",
        status: "active",
        priority: input.priority ?? 0,
        workflowRunId: input.workflowRunId ?? null,
        conversationId: input.conversationId ?? null,
        lastTouchedAt: new Date(),
        metadata: null,
      });
    }),

  commitmentUpdate: authedProcedure
    .use(rateLimit)
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(240).optional(),
        status: focusCommitmentStatusSchema.optional(),
        lane: focusLaneSchema.optional(),
        priority: z.number().int().min(0).max(10_000).optional(),
        workflowRunId: z.string().uuid().nullable().optional(),
        conversationId: z.string().uuid().nullable().optional(),
        lastTouchedAt: optionalNullableDateSchema,
        metadata: z.record(z.string(), z.unknown()).nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const existing = await focusRepo.getCommitmentById(input.id);
      assertResourceAccess(existing, userId, "commitment");

      return focusRepo.updateCommitment(input.id, {
        title: input.title ?? undefined,
        status: input.status ?? undefined,
        lane: input.lane ?? undefined,
        priority: input.priority ?? undefined,
        workflowRunId: input.workflowRunId ?? undefined,
        conversationId: input.conversationId ?? undefined,
        lastTouchedAt: input.lastTouchedAt,
        metadata: input.metadata ?? undefined,
      });
    }),

  commitmentTouch: authedProcedure
    .use(rateLimit)
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const existing = await focusRepo.getCommitmentById(input.id);
      assertResourceAccess(existing, userId, "commitment");
      await focusRepo.touchCommitment(input.id);
      return { ok: true };
    }),
});
