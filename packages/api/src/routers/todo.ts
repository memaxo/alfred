import { TRPCError } from "@trpc/server";
import z from "zod";
import { requireScopes } from "../middleware/scopes";
import { authedProcedure, router } from "../trpc";

/**
 * Todo Router
 *
 * CRUD operations for todos with MCP scope enforcement.
 *
 * Deprecated: use `task.*` routes backed by `assistant_tasks`.
 *
 * Required scopes:
 * - read:todos - List todos
 * - write:todos - Create, update, delete todos
 */
export const todoRouter = router({
  /**
   * List all todos for the authenticated user.
   * Requires: read:todos scope
   */
  getAll: authedProcedure
    .use(requireScopes({ required: "read:todos" }))
    .query(() => {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "todo_deprecated_use_task",
      });
    }),

  /**
   * Create a new todo.
   * Requires: write:todos scope
   */
  create: authedProcedure
    .use(requireScopes({ required: "write:todos" }))
    .input(z.object({ text: z.string().min(1) }))
    .mutation(() => {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "todo_deprecated_use_task",
      });
    }),

  /**
   * Toggle todo completion status.
   * Requires: write:todos scope
   */
  toggle: authedProcedure
    .use(requireScopes({ required: "write:todos" }))
    .input(z.object({ id: z.number(), completed: z.boolean() }))
    .mutation(() => {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "todo_deprecated_use_task",
      });
    }),

  /**
   * Delete a todo.
   * Requires: write:todos scope
   */
  delete: authedProcedure
    .use(requireScopes({ required: "write:todos" }))
    .input(z.object({ id: z.number() }))
    .mutation(() => {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "todo_deprecated_use_task",
      });
    }),
});
