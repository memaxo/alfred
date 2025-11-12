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
};

/**
 * Creates a test tRPC caller with authenticated session.
 * Use this utility in all API router tests for consistent setup.
 */
export function createTestCaller(options: CreateCallerOptions = {}) {
  const userId = options.userId ?? "test-user";
  const roles = options.roles ?? ["owner"];
  const scopes = options.scopes ?? ["assistant.write", "assistant.stream"];
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

  // Dynamic import to avoid circular dependencies
  return import("@alfred/api/routers/index").then((mod) =>
    mod.appRouter.createCaller({
      session: {
        user: {
          id: userId,
          roles,
          scopes,
          email: `${userId}@test.local`,
          name: "Test User",
        },
        session: { id: `sess-${requestId}` },
      },
      runtime,
      runtimeContext,
      policy: {
        obligations: [],
      },
    } as Parameters<typeof mod.appRouter.createCaller>[0])
  );
}
