import { RuntimeContext } from "@alfred/type/runtime-context";

type WorkflowRuntime = {
  requestId: string;
  receivedAt: Date;
  method: string;
  url: string;
  ip: string | null;
  forwardedFor: string[];
  userAgent: string | null;
  referer: string | null;
};

export type WorkflowTestUser = {
  id: string;
  email: string;
  name: string;
  roles: string[];
  scopes: string[];
};

export const DEFAULT_WORKFLOW_TEST_USER: WorkflowTestUser = {
  id: "workflow-test-user",
  email: "workflow.test@test.local",
  name: "Workflow Test",
  roles: ["owner"],
  scopes: [
    "workflow.plan",
    "workflow.stream",
    "workflow.resume",
    "workflow.read",
  ],
};

type WorkflowCallerOptions = {
  user?: WorkflowTestUser;
  runtime?: Partial<WorkflowRuntime>;
  obligations?: string[];
};

let cachedWorkflowRouter:
  | typeof import("@alfred/api/routers/workflow").workflowRouter
  | null = null;

async function getWorkflowRouter() {
  if (!cachedWorkflowRouter) {
    ({ workflowRouter: cachedWorkflowRouter } = await import(
      "@alfred/api/routers/workflow"
    ));
  }
  return cachedWorkflowRouter;
}

function createRuntime(options?: Partial<WorkflowRuntime>): WorkflowRuntime {
  const requestId = options?.requestId ?? `workflow-test-${Date.now()}`;
  return {
    requestId,
    receivedAt: options?.receivedAt ?? new Date(),
    method: options?.method ?? "POST",
    url: options?.url ?? "http://localhost/trpc",
    ip: options?.ip ?? null,
    forwardedFor: options?.forwardedFor ?? [],
    userAgent: options?.userAgent ?? "bun-test",
    referer: options?.referer ?? null,
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
  ]);

  const user = options.user ?? DEFAULT_WORKFLOW_TEST_USER;

  return router.createCaller({
    session: {
      user,
      session: { id: `sess-${runtime.requestId}` },
    },
    runtime,
    runtimeContext,
    policy: { obligations: options.obligations ?? [] },
  } as Parameters<typeof router.createCaller>[0]);
}
