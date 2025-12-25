// packages/api/src/routers/project.ts
import { projectRepo } from "@alfred/db";
import { detectProject } from "@alfred/plan";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";
import { TRPCError } from "@trpc/server";

export const projectRouter = router({
  /**
   * Detect or create a project based on workspace path
   */
  detect: authedProcedure
    .input(z.object({ workspace: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      return await detectProject(input.workspace, userId);
    }),

  /**
   * Get a project by ID
   */
  get: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const project = await projectRepo.getProjectById(input.id);
      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "project_not_found",
        });
      }

      // Ensure user owns project
      if (project.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "project_access_denied",
        });
      }

      return project;
    }),

  /**
   * List all projects for the current user
   */
  list: authedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }

    // We need a listProjects repo function
    // For now, let's just query directly or add it to repo
    // I'll add listProjects to repo
    return await projectRepo.getProjectsByUserId(userId);
  }),
});
