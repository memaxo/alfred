import * as workflowRepo from "@alfred/db/repo/workflow";
import { workflowCompilationSchema } from "@alfred/type/compilation";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { requirePolicy } from "../../gate";
import { authedProcedure, rateLimit, router } from "../../trpc";
import { mapWorkflowRunResourceLocal } from "../../workflow/resource";

export const workflowCompilationRouter = router({
  get: authedProcedure
    .use(rateLimit)
    .use(
      requirePolicy("workflow.read", (raw) => mapWorkflowRunResourceLocal(raw))
    )
    .input(z.object({ runId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const run = await workflowRepo.getRun(input.runId);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "run_not_found" });
      }
      if (run.userId !== session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "access_denied" });
      }

      const stateData =
        run.stateData &&
        typeof run.stateData === "object" &&
        run.stateData !== null
          ? (run.stateData as Record<string, unknown>)
          : {};
      const compilation = stateData.compilation;
      const parsed = workflowCompilationSchema.safeParse(compilation);
      return parsed.success ? parsed.data : null;
    }),
});
