import {
  createTask,
  deleteTask,
  getTasks,
  updateTask,
} from "@alfred/db/repo/assistant";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { optionalNullableDateSchema } from "../utils/zod-schemas";
import { authedProcedure, router } from "../trpc";

const statusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);

const taskCreateInput = z.object({
  projectId: z.string().uuid().optional(),
  title: z.string().min(1).max(256),
  description: z.string().max(4096).optional(),
  priority: z.number().int().min(0).max(10).optional(),
  due: z.string().datetime().optional(),
});

const taskListInput = z.object({
  projectId: z.string().uuid().optional(),
  status: statusSchema.optional(),
  limit: z.number().int().min(1).max(200).default(100),
});

const taskUpdateInput = z
  .object({
    id: z.string().min(1),
    projectId: z.string().uuid().nullable().optional(),
    title: z.string().min(1).max(256).optional(),
    description: z.string().max(4096).nullable().optional(),
    status: statusSchema.optional(),
    priority: z.number().int().min(0).max(10).nullable().optional(),
    due: optionalNullableDateSchema,
    completed: optionalNullableDateSchema,
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.description !== undefined ||
      v.status !== undefined ||
      v.priority !== undefined ||
      v.due !== undefined ||
      v.projectId !== undefined ||
      v.completed !== undefined ||
      v.metadata !== undefined,
    { message: "Provide at least one field to update.", path: ["title"] }
  );

export const taskRouter = router({
  create: authedProcedure
    .input(taskCreateInput)
    .mutation(async ({ ctx, input }) => {
      const row = await createTask(
        ctx.session.user.id,
        input.title,
        input.description ?? undefined,
        input.priority ?? 0,
        input.due ? new Date(input.due) : undefined,
        input.projectId
      );
      return row;
    }),

  list: authedProcedure
    .input(taskListInput)
    .query(({ ctx, input }) =>
      getTasks(ctx.session.user.id, input.status, input.limit, input.projectId)
    ),

  update: authedProcedure
    .input(taskUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const updated = await updateTask(ctx.session.user.id, input.id, {
        title: input.title,
        description: input.description ?? undefined,
        status: input.status,
        priority: input.priority ?? undefined,
        due: input.due,
        projectId: input.projectId ?? undefined,
        completed: input.completed,
        metadata: input.metadata ?? undefined,
      });
      if (updated === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "task_not_found" });
      }
      return { updated };
    }),

  delete: authedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteTask(ctx.session.user.id, input.id);
      if (deleted === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "task_not_found" });
      }
      return { deleted };
    }),
});
