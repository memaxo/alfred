/**
 * Process Linear OAuth callback.
 * 
 * This server function handles the OAuth callback from Linear.
 * It uses input validation with Zod and processes the callback via tRPC.
 * 
 * Note: This function does not use auth middleware because it's part of the
 * OAuth flow itself. For authenticated server functions, see the middleware
 * pattern in @/lib/middleware/auth.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const processCallback = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      code: z.string().min(1),
      state: z.string().min(1),
    })
  )
  .handler(async ({ data, request }) => {
    const { createContext } = await import("@alfred/api/context");
    const { appRouter } = await import("@alfred/api/routers/index");

    const ctx = await createContext({ req: request });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.linear.oauthCallback({
      code: data.code,
      state: data.state,
    });

    return result;
  });
