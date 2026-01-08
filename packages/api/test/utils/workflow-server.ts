import { auth } from "@alfred/auth";
import { db, workflowSchema } from "@alfred/db";
import {
  type AuthSession,
  createTestSession,
  serializeTestSession,
  type TestSession,
} from "@alfred/test-kit/auth";
import type { Obligation } from "@alfred/type";
import { getHeaderValue } from "../../src/utils/headers";
import {
  createWorkflowCaller,
  DEFAULT_WORKFLOW_TEST_USER,
  type WorkflowTestUser,
} from "./workflow-caller";

const TEST_SESSION_HEADER = "x-alfred-workflow-test-session";

type SessionPatchState = {
  count: number;
  restore: (() => void) | null;
};

const sessionPatchState: SessionPatchState = {
  count: 0,
  restore: null,
};

function installSessionPatch() {
  if (sessionPatchState.count === 0) {
    const authApi = auth.api as {
      getSession: (
        params: Parameters<(typeof auth)["api"]["getSession"]>[0]
      ) => ReturnType<(typeof auth)["api"]["getSession"]>;
    };
    const originalGetSession = authApi.getSession.bind(auth.api);
    const patchedGetSession = async (
      params: Parameters<(typeof auth)["api"]["getSession"]>[0]
    ) => {
      const header = getHeaderValue(params?.headers, TEST_SESSION_HEADER);
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
  obligations?: Obligation[];
};

export class WorkflowTestHarness {
  readonly user: WorkflowTestUser;
  readonly obligations: Obligation[];
  private readonly session: TestSession;
  private readonly sessionHeader: string;

  constructor(options?: WorkflowHarnessOptions) {
    installSessionPatch();
    this.user = {
      ...DEFAULT_WORKFLOW_TEST_USER,
      ...options?.user,
    };
    this.obligations = options?.obligations ?? [];
    this.session = createTestSession(this.user);
    this.sessionHeader = serializeTestSession(this.session);
  }

  headers(init?: HeadersInit): Headers {
    const headers = new Headers(init ?? {});
    headers.set("content-type", "application/json");
    headers.set(TEST_SESSION_HEADER, this.sessionHeader);
    return headers;
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
