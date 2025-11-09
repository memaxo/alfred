import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";
import {
  trpcRequestDurationSeconds,
  trpcRequestErrorsTotal,
  trpcRequestsTotal,
} from "./metrics";
import { rateLimitHitsTotal } from "./metrics";

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

// Simple in-memory rate limiter keyed by user + procedure per minute
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const windowMs = 60_000;
function getLimitPerMinute() {
  const raw = process.env.ROUTE_RATE_LIMIT_PER_MINUTE;
  const n = Number.parseInt(raw ?? "60", 10);
  return Math.max(1, Number.isFinite(n) ? n : 60);
}

function rateKey(userId: string | null, procedure?: string, type?: string) {
  return [userId ?? "anon", procedure ?? "unknown", type ?? "unknown"].join(":");
}

export const rateLimit = t.middleware(async ({ ctx, path, type, next }) => {
  const userId = (ctx.session as any)?.user?.id ?? null;
  const key = rateKey(userId, path, type);
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
  } else if (bucket.count + 1 > getLimitPerMinute()) {
    rateLimitHitsTotal.inc({ procedure: path ?? "unknown" });
    throw new TRPCError({ code: "TOO_MANY_REQUESTS" as any, message: "rate_limited" });
  } else {
    bucket.count++;
  }
  return next();
});
