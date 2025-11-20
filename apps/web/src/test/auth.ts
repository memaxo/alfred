import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import type { ReactElement } from "react";
import type { RenderResult } from "@testing-library/react";
import { renderRoute, type RenderRouteOptions } from "./render-route";

export const TEST_SESSION_HEADER = "x-alfred-test-session";

export type TestSessionUser = {
  id: string;
  email: string;
  name: string;
  roles: string[];
  scopes: string[];
};

export type TestSession = {
  user: TestSessionUser;
  session: {
    id: string;
  };
};

export function createTestSession(
  overrides: Partial<TestSessionUser & { sessionId: string }> = {}
): TestSession {
  const baseId = overrides.id ?? "test-user";
  return {
    user: {
      id: baseId,
      email: overrides.email ?? `${baseId}@example.com`,
      name: overrides.name ?? "Test User",
      roles: overrides.roles ?? ["owner"],
      scopes: overrides.scopes ?? ["assistant.write", "assistant.stream"],
    },
    session: {
      id: overrides.sessionId ?? `sess-${randomUUID()}`,
    },
  };
}

export function serializeTestSession(session: TestSession): string {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64");
}

export function deserializeTestSession(value: string | null): TestSession | null {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as TestSession;
  } catch (_error) {
    return null;
  }
}

type AuthenticatedRenderOptions = RenderRouteOptions & {
  session?: TestSession;
};

/**
 * Temporary helper that mirrors renderRoute but documents the intended
 * authentication shape for future suites. Once the Better Auth client exposes
 * a configurable provider we can wire the session through context rather than
 * mocks.
 */
export function authenticatedRender(
  ui: ReactElement,
  options: AuthenticatedRenderOptions = {}
): RenderResult {
  const session = options.session ?? createTestSession();
  (globalThis as { __TEST_SESSION__?: TestSession }).__TEST_SESSION__ = session;
  return renderRoute(ui, options);
}
