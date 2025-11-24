import type { RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  deserializeTestSession,
  issueTestSession,
  serializeTestSession,
  setTestPasskeys,
  setTestSession,
  TEST_SESSION_HEADER,
  type TestPasskey,
  type TestSession,
  type TestSessionUser,
} from "@/lib/test-auth";
import { type RenderRouteOptions, renderRoute } from "./render-route";

export {
  TEST_SESSION_HEADER,
  serializeTestSession,
  deserializeTestSession,
  setTestPasskeys,
  setTestSession,
  type TestPasskey,
  type TestSession,
  type TestSessionUser,
};

export function createTestSession(
  overrides: Partial<TestSessionUser & { sessionId: string }> = {}
): TestSession {
  return issueTestSession(overrides);
}

type AuthenticatedRenderOptions = RenderRouteOptions & {
  session?: TestSession;
};

export function authenticatedRender(
  ui: ReactElement,
  options: AuthenticatedRenderOptions = {}
): RenderResult {
  const session = options.session ?? issueTestSession();
  setTestSession(session);
  return renderRoute(ui, options);
}
