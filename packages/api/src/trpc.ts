import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";
import {
  trpcRequestDurationSeconds,
  trpcRequestErrorsTotal,
  trpcRequestsTotal,
} from "./metrics";

export const t = initTRPC.context<Context>().create();

const metricsMiddleware = t.middleware(async ({ path, type, next }) => {
  const labels = { procedure: path ?? "unknown", type };
  const stopTimer = trpcRequestDurationSeconds.startTimer(labels);

  try {
    const result = await next();
    trpcRequestsTotal.inc(labels);
    return result;
  } catch (error) {
    const code = error instanceof TRPCError ? error.code : "UNKNOWN";
    trpcRequestsTotal.inc(labels);
    trpcRequestErrorsTotal.inc({ ...labels, code });
    throw error;
  } finally {
    stopTimer();
  }
});

const authMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

export const router = t.router;

const baseProcedure = t.procedure.use(metricsMiddleware);

export const publicProcedure = baseProcedure;

export const protectedProcedure = baseProcedure.use(authMiddleware);

export const authedProcedure = protectedProcedure;

export type AuthedContext = {
  session: NonNullable<Context["session"]>;
  runtime: Context["runtime"];
  runtimeContext: Context["runtimeContext"];
  policy?: Context["policy"];
};
