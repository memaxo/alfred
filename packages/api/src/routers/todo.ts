import { db } from "@alfred/db";
import { todo } from "@alfred/db/schema/todo";
import { eq } from "drizzle-orm";
import z from "zod";
import { requireScopes } from "../middleware/scopes";
import { authedProcedure, router } from "../trpc";

/**
 * Todo Router
 *
 * CRUD operations for todos with MCP scope enforcement.
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
    .query(async () => await db.select().from(todo)),

  /**
   * Create a new todo.
   * Requires: write:todos scope
   */
  create: authedProcedure
    .use(requireScopes({ required: "write:todos" }))
    .input(z.object({ text: z.string().min(1) }))
    .mutation(
      async ({ input }) =>
        await db.insert(todo).values({
          text: input.text,
        })
    ),

  /**
   * Toggle todo completion status.
   * Requires: write:todos scope
   */
  toggle: authedProcedure
    .use(requireScopes({ required: "write:todos" }))
    .input(z.object({ id: z.number(), completed: z.boolean() }))
    .mutation(
      async ({ input }) =>
        await db
          .update(todo)
          .set({ completed: input.completed })
          .where(eq(todo.id, input.id))
    ),

  /**
   * Delete a todo.
   * Requires: write:todos scope
   */
  delete: authedProcedure
    .use(requireScopes({ required: "write:todos" }))
    .input(z.object({ id: z.number() }))
    .mutation(
      async ({ input }) => await db.delete(todo).where(eq(todo.id, input.id))
    ),
});
