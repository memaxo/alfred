import * as assistantRepo from "@alfred/db/repo/assistant";
import { ensureMirrorNodes } from "@alfred/db/repo/graph/write";
import z from "zod";
import { authedProcedure, router } from "../trpc";

const reminderBase = z.object({
  title: z.string().min(1).max(256),
  description: z.string().max(2048).optional(),
  recurring: z.string().max(128).optional(),
});

const reminderCreateInput = reminderBase.extend({
  due: z.string().datetime(),
});

const reminderListInput = z.object({
  limit: z.number().int().min(1).max(200).default(100),
  offset: z.number().int().min(0).default(0),
});

export const remindRouter = router({
  create: authedProcedure
    .input(reminderCreateInput)
    .mutation(async ({ ctx, input }) => {
      const reminder = await assistantRepo.createReminder(
        ctx.session.user.id,
        input.title,
        new Date(input.due),
        input.description,
        input.recurring
      );

      await ensureMirrorNodes("user", [
        {
          kind: "reminder",
          id: reminder.id,
          label: reminder.title,
          properties: {
            entity: { kind: "reminder", id: reminder.id },
            title: reminder.title,
            due: reminder.due instanceof Date ? reminder.due.toISOString() : null,
            status: reminder.fired ? "fired" : "scheduled",
          },
        },
      ]);

      return reminder;
    }),

  list: authedProcedure
    .input(reminderListInput)
    .query(({ ctx, input }) =>
      assistantRepo.getReminders(
        ctx.session.user.id,
        input.limit ?? 100,
        input.offset ?? 0
      )
    ),

  due: authedProcedure
    .input(z.object({ before: z.string().datetime().optional() }))
    .query(({ ctx, input }) =>
      assistantRepo.getDueReminders(
        ctx.session.user.id,
        input.before ? new Date(input.before) : new Date()
      )
    ),

  fire: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const updated = await assistantRepo.markReminderFired(input.id);

      await ensureMirrorNodes("user", [
        {
          kind: "reminder",
          id: input.id,
          properties: {
            entity: { kind: "reminder", id: input.id },
            status: "fired",
            firedAt: new Date().toISOString(),
          },
        },
      ]);

      return { updated };
    }),

  delete: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const deleted = await assistantRepo.deleteReminder(input.id);

      await ensureMirrorNodes("user", [
        {
          kind: "reminder",
          id: input.id,
          properties: {
            entity: { kind: "reminder", id: input.id },
            deletedAt: new Date().toISOString(),
          },
        },
      ]);

      return { deleted };
    }),
});
