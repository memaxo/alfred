import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

// Lazy metrics wiring to keep test environment light and avoid import-time side effects
type TrpcLabels = {
  procedure: string;
  type: string;
};
type TrpcErrorLabels = TrpcLabels & { code: string };
type RateLimitLabels = { procedure: string };
type Metrics = {
  trpcRequestDurationSeconds: { startTimer: (labels: TrpcLabels) => () => void };
  trpcRequestErrorsTotal: { inc: (labels: TrpcErrorLabels) => void };
  trpcRequestsTotal: { inc: (labels: TrpcLabels) => void };
  rateLimitHitsTotal: { inc: (labels: RateLimitLabels) => void };
};
let metricsRef: Metrics | null = null;

const noopMetrics: Metrics = {
  trpcRequestDurationSeconds: { startTimer: () => () => {} },
  trpcRequestErrorsTotal: { inc: () => {} },
  trpcRequestsTotal: { inc: () => {} },
  rateLimitHitsTotal: { inc: () => {} },
};

async function getMetrics(): Promise<Metrics> {
  if (process.env.DISABLE_TRPC_METRICS === "1") {
    return noopMetrics;
  }
  if (metricsRef) {
    return metricsRef;
  }
  try {
    const m = await import("@alfred/api/metrics");
    metricsRef = {
      trpcRequestDurationSeconds: m.trpcRequestDurationSeconds,
      trpcRequestErrorsTotal: m.trpcRequestErrorsTotal,
      trpcRequestsTotal: m.trpcRequestsTotal,
      rateLimitHitsTotal: m.rateLimitHitsTotal,
    };
    return metricsRef;
  } catch (_err) {
    return noopMetrics;
  }
}

const metricsMiddleware = t.middleware(async ({ path, type, next }) => {
  const labels = { procedure: path ?? "unknown", type };
  const m = await getMetrics();
  const stopTimer = m.trpcRequestDurationSeconds.startTimer(labels);

  try {
    const result = await next();
    m.trpcRequestsTotal.inc(labels);
    return result;
  } catch (error) {
    const code = error instanceof TRPCError ? error.code : "UNKNOWN";
    m.trpcRequestsTotal.inc(labels);
    m.trpcRequestErrorsTotal.inc({ ...labels, code });
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

// Simple global rate limiter for single-user context
// 1000 requests per minute is plenty for a personal assistant
let requestCount = 0;
let resetTime = Date.now() + 60_000;
const RATE_LIMIT = 1000;

function getLimitPerMinute() {
  const raw = process.env.ROUTE_RATE_LIMIT_PER_MINUTE;
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : RATE_LIMIT;
}

export const rateLimit = t.middleware(async ({ path, next }) => {
  const now = Date.now();

  // Reset counter at the start of each minute window
  if (now > resetTime) {
    requestCount = 0;
    resetTime = now + 60_000;
  }

  // Increment and check limit
  if (++requestCount > getLimitPerMinute()) {
    const m = await getMetrics();
    m.rateLimitHitsTotal.inc({ procedure: path ?? "unknown" });
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS" as TRPCError["code"],
      message: "rate_limited",
    });
  }

  return next();
});

/**
 * Consumes the route rate limit.
 * Simplified for single-user context - just increments global counter.
 * @deprecated Use rateLimit middleware instead
 */
export async function consumeRouteRateLimit(
  _routeId: string,
  _sessionId?: string | null
): Promise<void> {
  const now = Date.now();
  if (now > resetTime) {
    requestCount = 0;
    resetTime = now + 60_000;
  }
  if (++requestCount > getLimitPerMinute()) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS" as TRPCError["code"],
      message: "rate_limited",
    });
  }
}
