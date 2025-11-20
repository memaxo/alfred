/**
 * tRPC createCaller test utility
 * Reusable helper for creating authenticated tRPC callers in tests
 */

import "./mock-metrics";
import "./mock-db-client";
import "./mock-voice";
import type { TRPCAppRouter } from "@alfred/api/routers/index";
import { RuntimeContext } from "@alfred/type/runtime-context";
import type { inferRouterInputs } from "@trpc/server";

type RouterInputs = inferRouterInputs<TRPCAppRouter>;

type CreateCallerOptions = {
  userId?: string;
  roles?: string[];
  scopes?: string[];
  requestId?: string;
  obligations?: string[];
};

/**
 * Creates a test tRPC caller with authenticated session.
 * Use this utility in all API router tests for consistent setup.
 */
type RuntimeBundle = {
  userId: string | null;
  roles: string[];
  scopes: string[];
  runtime: {
    requestId: string;
    receivedAt: Date;
    method: string;
    url: string;
    ip: string | null;
    forwardedFor: string[];
    userAgent: string | null;
    referer: string | null;
  };
  runtimeContext: RuntimeContext;
};

function createRuntimeBundle(options: {
  userId: string | null;
  roles?: string[];
  scopes?: string[];
  requestId?: string;
}): RuntimeBundle {
  const userId = options.userId;
  const roles = options.roles ?? (userId ? ["owner"] : []);
  const scopes =
    options.scopes ?? (userId ? ["assistant.write", "assistant.stream"] : []);
  const requestId = options.requestId ?? `test-${Date.now()}`;

  const receivedAt = new Date();
  const runtime = {
    requestId,
    receivedAt,
    method: "POST",
    url: "http://localhost/test",
    ip: null,
    forwardedFor: [] as string[],
    userAgent: null,
    referer: null,
  };

  const runtimeContext = new RuntimeContext([
    ["requestId", runtime.requestId],
    ["receivedAt", receivedAt.toISOString()],
    ["method", runtime.method],
    ["url", runtime.url],
    ["ip", runtime.ip],
    ["forwardedFor", runtime.forwardedFor],
    ["userId", userId],
    ["userRoles", roles],
    ["userScopes", scopes],
  ]);

  return { runtime, runtimeContext, userId, roles, scopes };
}

export async function createTestCaller(options: CreateCallerOptions = {}) {
  const bundle = createRuntimeBundle({
    userId: options.userId ?? "test-user",
    roles: options.roles,
    scopes: options.scopes,
    requestId: options.requestId,
  });

  const mod = await import("@alfred/api/routers/index");
  return mod.appRouter.createCaller({
    session: {
      user: {
        id: bundle.userId ?? "test-user",
        roles: bundle.roles,
        scopes: bundle.scopes,
        email: `${(bundle.userId ?? "test-user")}@test.local`,
        name: "Test User",
      },
      session: { id: `sess-${bundle.runtime.requestId}` },
    },
    runtime: bundle.runtime,
    runtimeContext: bundle.runtimeContext,
    policy: {
      obligations: options.obligations ?? [],
    },
  } as Parameters<typeof mod.appRouter.createCaller>[0]);
}

export async function createUnauthedCaller() {
  const bundle = createRuntimeBundle({
    userId: null,
  });
  const mod = await import("@alfred/api/routers/index");
  return mod.appRouter.createCaller({
    session: null,
    runtime: bundle.runtime,
    runtimeContext: bundle.runtimeContext,
    policy: { obligations: [] },
  } as Parameters<typeof mod.appRouter.createCaller>[0]);
}
