// packages/api/src/routers/project.ts
import { projectRepo } from "@alfred/db";
import { getLinearByOAuth } from "@alfred/db/repo/linear";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";
import { ensureValidToken, getClientId } from "./linear-helpers";

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

      const { detectProject } = await import("@alfred/plan");
      return await detectProject(input.workspace, userId);
    }),

  /**
   * Link an ALFRED Project to a Linear Project
   */
  linkLinear: authedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        linearProjectId: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const project = await projectRepo.getProjectById(input.projectId);
      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "project_not_found",
        });
      }

      if (project.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "project_access_denied",
        });
      }

      const installation = await getLinearByOAuth(getClientId());
      await ensureValidToken(installation);
      const linearSpaceId = installation?.space?.trim();
      if (!linearSpaceId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "linear_not_connected",
        });
      }

      try {
        const { linkLinearProject } = await import("@alfred/plan");
        return await linkLinearProject(input.projectId, input.linearProjectId, {
          linearSpaceId,
        });
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error ? error.message : "linear_link_failed",
        });
      }
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
