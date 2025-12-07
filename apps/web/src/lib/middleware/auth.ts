/**
 * Authentication middleware for server functions.
 * 
 * This middleware provides reusable authentication logic for server functions.
 * It checks for a valid session and provides user context to the handler.
 * 
 * Usage:
 * ```typescript
 * export const myServerFn = createServerFn()
 *   .middleware([requireAuthMiddleware])
 *   .handler(async ({ context }) => {
 *     // context.user is available here
 *     const userId = context.user.id
 *     // ...
 *   })
 * ```
 */
import { createMiddleware } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

/**
 * Require authentication middleware.
 * 
 * This middleware ensures that a valid session exists before executing
 * the server function. If no session is found, it redirects to the login page.
 * 
 * If authentication succeeds, it provides the user and session in the context
 * for use in the server function handler.
 */
export const requireAuthMiddleware = createMiddleware({ type: "function" })
  .server(async ({ next }) => {
    const session = await authClient.getSession();

    if (!session.data) {
      throw redirect({ to: "/login" });
    }

    return next({
      context: {
        user: session.data.user,
        session: session.data.session,
      },
    });
  });
