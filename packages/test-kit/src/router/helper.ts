import { randomUUID } from "node:crypto";
import { expect } from "bun:test";
import type { Context } from "@alfred/api/context";
import type { AppRouter } from "@alfred/api/routers/index";
import type { Obligation } from "@alfred/type";
import { RuntimeContext } from "@alfred/type/runtime-context";
import { createTestSession } from "../auth/session";

type RuntimeOverrides = Partial<{
  requestId: string;
  receivedAt: Date;
  method: string;
  url: string;
  ip: string | null;
  forwardedFor: string[];
  userAgent: string | null;
  referer: string | null;
}>;

export type CreateAuthedCallerOptions = {
  roles?: string[];
  scopes?: string[];
  obligations?: Obligation[];
  runtime?: RuntimeOverrides;
  email?: string;
  name?: string;
};

type Caller = ReturnType<AppRouter["createCaller"]>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorCode(error: unknown): string | null {
  if (!isRecord(error)) {
    return null;
  }
  const code = error["code"];
  return typeof code === "string" ? code : null;
}

function createRuntimeBundle(options: {
  userId: string | null;
  roles: string[];
  scopes: string[];
  runtime?: RuntimeOverrides;
}): Pick<Context, "runtime" | "runtimeContext"> {
  const receivedAt = options.runtime?.receivedAt ?? new Date();
  const runtime = {
    requestId: options.runtime?.requestId ?? `test-${randomUUID()}`,
    receivedAt,
    method: options.runtime?.method ?? "POST",
    url: options.runtime?.url ?? "http://localhost/test",
    ip: options.runtime?.ip ?? null,
    forwardedFor: options.runtime?.forwardedFor ?? [],
    userAgent: options.runtime?.userAgent ?? null,
    referer: options.runtime?.referer ?? null,
  };

  const entries: [string, unknown][] = [
    ["requestId", runtime.requestId],
    ["receivedAt", runtime.receivedAt.toISOString()],
    ["method", runtime.method],
    ["url", runtime.url],
    ["ip", runtime.ip],
    ["forwardedFor", runtime.forwardedFor],
  ];

  if (options.userId) {
    entries.push(["userId", options.userId]);
  }
  if (options.roles.length > 0) {
    entries.push(["userRoles", options.roles]);
  }
  if (options.scopes.length > 0) {
    entries.push(["userScopes", options.scopes]);
  }
  entries.push(["scanContext", null]);

  return {
    runtime,
    runtimeContext: new RuntimeContext(entries),
  };
}

/**
 * Creates an authenticated tRPC caller for API router tests.
 *
 * Note: If the router import pulls heavy dependencies, use the standard preloads
 * in `packages/api/test` (mock metrics/db/voice) or provide equivalent mocks.
 */
export async function createAuthedCaller(
  userId: string,
  options: CreateAuthedCallerOptions = {}
): Promise<Caller> {
  const roles = options.roles ?? ["owner"];
  const scopes = options.scopes ?? ["assistant.write", "assistant.stream"];
  const session = createTestSession({
    id: userId,
    email: options.email ?? `${userId}@test.local`,
    name: options.name ?? "Test User",
    roles,
    scopes,
  });

  const { runtime, runtimeContext } = createRuntimeBundle({
    userId,
    roles,
    scopes,
    runtime: options.runtime,
  });

  const ctx: Context = {
    session,
    runtime,
    runtimeContext,
    policy: { obligations: options.obligations ?? [] },
  };

  const mod = await import("@alfred/api/routers/index");
  return mod.appRouter.createCaller(ctx) as Caller;
}

/**
 * Creates an unauthenticated tRPC caller for API router tests.
 */
export async function createUnauthedCaller(
  runtime?: RuntimeOverrides
): Promise<Caller> {
  const { runtime: meta, runtimeContext } = createRuntimeBundle({
    userId: null,
    roles: [],
    scopes: [],
    runtime,
  });

  const ctx: Context = {
    session: null,
    runtime: meta,
    runtimeContext,
    policy: { obligations: [] },
  };

  const mod = await import("@alfred/api/routers/index");
  return mod.appRouter.createCaller(ctx) as Caller;
}

/**
 * Assert that a call is rejected by the auth middleware (UNAUTHORIZED).
 */
export async function assertAuthGuard(
  operation: Promise<unknown> | (() => Promise<unknown>)
): Promise<void> {
  const promise = typeof operation === "function" ? operation() : operation;
  try {
    await promise;
  } catch (error) {
    const code = getErrorCode(error);
    if (code === "UNAUTHORIZED") {
      return;
    }
  }

  await expect(promise).rejects.toMatchObject({ code: "UNAUTHORIZED" });
}

/**
 * Assert that policy middleware was invoked by checking `@alfred/policy.evaluate` calls.
 *
 * For reliability, call this only when the test has mocked `@alfred/policy`.
 */
export async function assertPolicyEnforced(options: {
  action?: string;
  evaluate?: unknown;
} = {}): Promise<void> {
  const evaluate =
    options.evaluate ?? (await import("@alfred/policy")).evaluate ?? null;

  if (typeof evaluate !== "function" || !("mock" in evaluate)) {
    throw new Error(
      "Policy enforcement assertion requires a mocked @alfred/policy.evaluate() (vi.fn)."
    );
  }

  const mock = (evaluate as unknown as { mock: { calls: unknown[][] } }).mock;
  const calls = mock?.calls ?? [];
  if (calls.length === 0) {
    throw new Error("Expected @alfred/policy.evaluate to be called at least once.");
  }

  if (!options.action) {
    return;
  }

  const matched = calls.some(([arg]) => {
    if (!isRecord(arg)) {
      return false;
    }
    return arg["action"] === options.action;
  });

  if (!matched) {
    throw new Error(
      `Expected @alfred/policy.evaluate to be called with action "${options.action}".`
    );
  }
}

