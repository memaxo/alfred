/**
 * GenUI Router
 *
 * Handles form submissions and GenUI interactions.
 */

import { z } from "zod";
import { authedProcedure, router } from "../trpc";
import { inject } from "../services/form";

export const submitSchema = z.object({
  formId: z.string(),
  conversationId: z.string(),
  toolCallId: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
  schema: z.unknown().optional(),
});

export const genuiRouter = router({
  submit: authedProcedure
    .input(submitSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      await inject({
        userId,
        conversationId: input.conversationId,
        formId: input.formId,
        toolCallId: input.toolCallId,
        data: input.data,
        schema: input.schema,
      });

      return { success: true };
    }),
});
