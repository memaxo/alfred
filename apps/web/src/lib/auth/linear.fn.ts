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
