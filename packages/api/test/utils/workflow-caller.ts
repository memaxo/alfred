import { createTestSession, type TestSession } from "@alfred/test-kit/auth";
import { type Obligation } from "@alfred/type";
import { RuntimeContext } from "@alfred/type/runtime-context";

interface WorkflowRuntime {
  requestId: string;
  receivedAt: Date;
  method: string;
  url: string;
  ip: string | null;
  forwardedFor: string[];
  userAgent: string | null;
  referer: string | null;
}

export interface WorkflowTestUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  scopes: string[];
}

export const DEFAULT_WORKFLOW_TEST_USER: WorkflowTestUser = {
  email: "workflow.test@test.local",
  id: "workflow-test-user",
  name: "Workflow Test",
  roles: ["owner"],
  scopes: [
    "workflow.plan",
    "workflow.stream",
    "workflow.resume",
    "workflow.read",
  ],
};

interface WorkflowCallerOptions {
  user?: WorkflowTestUser | null;
  runtime?: Partial<WorkflowRuntime>;
  obligations?: Obligation[];
}

let cachedWorkflowRouter:
  | typeof import("@alfred/api/routers/workflow").workflowRouter
  | null = null;

async function getWorkflowRouter() {
  if (!cachedWorkflowRouter) {
    ({ workflowRouter: cachedWorkflowRouter } =
      await import("@alfred/api/routers/workflow"));
  }
  return cachedWorkflowRouter;
}

function createRuntime(options?: Partial<WorkflowRuntime>): WorkflowRuntime {
  const requestId = options?.requestId ?? `workflow-test-${Date.now()}`;
  return {
    forwardedFor: options?.forwardedFor ?? [],
    ip: options?.ip ?? null,
    method: options?.method ?? "POST",
    receivedAt: options?.receivedAt ?? new Date(),
    referer: options?.referer ?? null,
    requestId,
    url: options?.url ?? "http://localhost/trpc",
    userAgent: options?.userAgent ?? "bun-test",
  };
}

export async function createWorkflowCaller(
  options: WorkflowCallerOptions = {}
) {
  const router = await getWorkflowRouter();
  const runtime = createRuntime(options.runtime);
  const runtimeContext = new RuntimeContext([
    ["requestId", runtime.requestId],
    ["receivedAt", runtime.receivedAt.toISOString()],
    ["method", runtime.method],
    ["url", runtime.url],
    ["scanContext", null],
  ]);

  const resolvedUser =
    options.user === undefined ? DEFAULT_WORKFLOW_TEST_USER : options.user;

  // Create a properly typed session using test-kit factory
  const session: TestSession | null =
    resolvedUser === null
      ? null
      : createTestSession(resolvedUser, {
          session: { sessionId: `sess-${runtime.requestId}` },
        });

  const context = {
    policy: { obligations: options.obligations ?? [] },
    runtime,
    runtimeContext,
    session,
  } satisfies Parameters<typeof router.createCaller>[0];

  return router.createCaller(context);
}
