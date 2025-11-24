import { randomUUID } from "node:crypto";
import { auth } from "@alfred/auth";
import { db, workflowSchema } from "@alfred/db";
import type { WorkflowInputPayload } from "@alfred/agent/workflow/schema";
import {
  DEFAULT_WORKFLOW_TEST_USER,
  createWorkflowCaller,
  type WorkflowTestUser,
} from "./workflow-caller";

const TEST_SESSION_HEADER = "x-alfred-workflow-test-session";

type AuthSession = Awaited<ReturnType<(typeof auth)["api"]["getSession"]>>;

type SessionPatchState = {
  count: number;
  restore: (() => void) | null;
};

const sessionPatchState: SessionPatchState = {
  count: 0,
  restore: null,
};

function normalizeUser(user: WorkflowTestUser) {
  return {
    id: user.id,
    email: user.email ?? `${user.id}@test.local`,
    name: user.name ?? "Workflow Test User",
    roles: user.roles,
    scopes: user.scopes,
  };
}

function createAuthSession(
  user: WorkflowTestUser,
  sessionId: string = randomUUID()
): AuthSession {
  return {
    user: normalizeUser(user),
    session: {
      id: sessionId,
    },
  } as AuthSession;
}

function encodeSession(session: AuthSession): string {
  return JSON.stringify({
    user: session.user,
    session: session.session,
  });
}

function installSessionPatch() {
  if (sessionPatchState.count === 0) {
    const authApi = auth.api as {
      getSession: (params: Parameters<
        (typeof auth)["api"]["getSession"]
      >[0]) => ReturnType<(typeof auth)["api"]["getSession"]>;
    };
    const originalGetSession = authApi.getSession.bind(auth.api);
    const patchedGetSession = async (
      params: Parameters<(typeof auth)["api"]["getSession"]>[0]
    ) => {
      const header = params?.headers?.get(TEST_SESSION_HEADER);
      if (header) {
        return JSON.parse(header) as AuthSession;
      }
      return originalGetSession(params);
    };

    authApi.getSession = patchedGetSession as typeof authApi.getSession;
    sessionPatchState.restore = () => {
      authApi.getSession = originalGetSession as typeof authApi.getSession;
      sessionPatchState.restore = null;
    };
  }
  sessionPatchState.count += 1;
}

function releaseSessionPatch() {
  sessionPatchState.count -= 1;
  if (sessionPatchState.count <= 0 && sessionPatchState.restore) {
    sessionPatchState.restore();
    sessionPatchState.count = 0;
  }
}

async function resetWorkflowRecords() {
  const { workflowEvents, workflowRuns } = workflowSchema;
  await db.delete(workflowEvents);
  await db.delete(workflowRuns);
}

export type WorkflowHarnessOptions = {
  user?: Partial<WorkflowTestUser>;
  obligations?: string[];
};

export class WorkflowTestHarness {
  readonly user: WorkflowTestUser;
  readonly obligations: string[];
  private readonly session: AuthSession;
  private readonly sessionHeader: string;

  constructor(options?: WorkflowHarnessOptions) {
    installSessionPatch();
    this.user = {
      ...DEFAULT_WORKFLOW_TEST_USER,
      ...options?.user,
    };
    this.obligations = options?.obligations ?? [];
    this.session = createAuthSession(this.user);
    this.sessionHeader = encodeSession(this.session);
  }

  headers(init?: HeadersInit): Headers {
    const headers = new Headers(init ?? {});
    headers.set("content-type", "application/json");
    headers.set(TEST_SESSION_HEADER, this.sessionHeader);
    return headers;
  }

  request(
    input: WorkflowInputPayload,
    headers?: HeadersInit
  ): Request {
    return new Request("http://localhost/api/workflow/stream", {
      method: "POST",
      headers: this.headers(headers),
      body: JSON.stringify(input),
    });
  }

  async invoke(
    handler: (request: Request) => Promise<Response>,
    input: WorkflowInputPayload,
    headers?: HeadersInit
  ): Promise<Response> {
    return handler(this.request(input, headers));
  }

  async createCaller() {
    return createWorkflowCaller({
      user: this.user,
      obligations: this.obligations,
    });
  }

  async reset() {
    await resetWorkflowRecords();
  }

  async close() {
    releaseSessionPatch();
  }
}

export async function withWorkflowHarness<T>(
  fn: (harness: WorkflowTestHarness) => Promise<T>,
  options?: WorkflowHarnessOptions
): Promise<T> {
  const harness = new WorkflowTestHarness(options);
  try {
    return await fn(harness);
  } finally {
    await harness.close();
  }
}

export { TEST_SESSION_HEADER };
