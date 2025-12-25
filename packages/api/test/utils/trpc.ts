/**
 * tRPC createCaller test utility
 * Reusable helper for creating authenticated tRPC callers in tests
 */

process.env.OPENAI_API_KEY = "test";

import "./mock-metrics";
import "./mock-db-client";
import "./mock-voice";
import "./mock-hypergraph";
import "./mock-node-pty";
import type { Obligation } from "@alfred/type";
import { RuntimeContext } from "@alfred/type/runtime-context";
import { createAuthedCaller } from "@alfred/test-kit/router";

// type RouterInputs = inferRouterInputs<TRPCAppRouter>;

type CreateCallerOptions = {
  userId?: string;
  roles?: string[];
  scopes?: string[];
  requestId?: string;
  obligations?: Obligation[];
};

/**
 * Creates a test tRPC caller with authenticated session.
 * Use this utility in all API router tests for consistent setup.
 */
export async function createTestCaller(options: CreateCallerOptions = {}) {
  return createAuthedCaller(options.userId ?? "test-user", {
    roles: options.roles,
    scopes: options.scopes,
    runtime: { requestId: options.requestId },
    obligations: options.obligations,
  });
}

export async function createUnauthedCaller() {
  const mod = await import("@alfred/api/routers/index");
  const requestId = `test-${Date.now()}`;
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
    ["requestId", requestId],
    ["receivedAt", receivedAt.toISOString()],
    ["method", runtime.method],
    ["url", runtime.url],
    ["ip", runtime.ip],
    ["forwardedFor", runtime.forwardedFor],
    ["scanContext", null],
  ]);
  return mod.appRouter.createCaller({
    session: null,
    runtime,
    runtimeContext,
    policy: { obligations: [] },
  } as Parameters<typeof mod.appRouter.createCaller>[0]);
}
