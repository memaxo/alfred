import "@/test/dom";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { sql } from "drizzle-orm";
import type { ComponentProps, ComponentType, ReactNode } from "react";
import { randomUUID } from "node:crypto";
import { mock } from "bun:test";
import { createTestClient } from "@/test/client";
import {
  createTestSession,
  setTestSession,
  type TestSession,
} from "@/test/auth";
import { renderRoute } from "@/test/render-route";
import {
  cleanupTestServer,
  createTestServer,
  type TestServer,
} from "@/test/server";
import { workflowRuns } from "../../../../../packages/db/src/schema/workflow";

mock.module("@radix-ui/react-select", () => {
  const Select = ({ children }: { children: ReactNode }) => (
    <div data-testid="mock-select">{children}</div>
  );
  const SelectTrigger = ({
    children,
    ...props
  }: ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  );
  const SelectValue = ({
    children,
  }: {
    children?: ReactNode;
  }) => <span>{children ?? "all"}</span>;
  const SelectContent = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  const SelectItem = ({
    children,
    ...props
  }: ComponentProps<"div">) => (
    <div role="option" {...props}>
      {children}
    </div>
  );
  return {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
  };
});

mock.module("@/components/ui/dialog", () => {
  const passthrough =
    (tag: "div" | "section" = "div") =>
    ({ children, ...props }: { children: ReactNode }) =>
      tag === "section" ? (
        <section {...props}>{children}</section>
      ) : (
        <div {...props}>{children}</div>
      );
  return {
    Dialog: passthrough(),
    DialogContent: passthrough(),
    DialogHeader: passthrough(),
    DialogTitle: passthrough("section"),
    DialogDescription: passthrough(),
  };
});

const describeE2E = process.env.DATABASE_URL ? describe : describe.skip;

const workflowRouteModule = await import("../_authed/workflows");
const WorkflowsRouteComponent = workflowRouteModule.Route?.options
  ?.component as ComponentType | undefined;

if (!WorkflowsRouteComponent) {
  throw new Error("Workflows route component is unavailable");
}

async function truncateWorkflowTables(server: TestServer) {
  try {
    await server.db.execute(sql`TRUNCATE TABLE workflow_events, workflow_runs CASCADE`);
  } catch (error) {
    console.warn(
      "[ui-test] unable to truncate workflow tables:",
      error instanceof Error ? error.message : error
    );
  }
}

async function seedWorkflowRuns(server: TestServer, session: TestSession) {
  const now = new Date("2025-01-01T10:00:00Z");
  await server.db.insert(workflowRuns).values([
    {
      id: randomUUID(),
      userId: session.user.id,
      workflowId: "daily-sync",
      status: "completed",
      created: now,
      completedAt: new Date(now.getTime() + 5 * 60 * 1000),
      inputData: { source: "cron" },
    },
    {
      id: randomUUID(),
      userId: session.user.id,
      workflowId: "import-pipeline",
      status: "failed",
      created: new Date(now.getTime() + 10 * 60 * 1000),
      completedAt: new Date(now.getTime() + 12 * 60 * 1000),
      errorMessage: "Upstream dependency timed out",
    },
    {
      id: randomUUID(),
      userId: session.user.id,
      workflowId: "weekly-summary",
      status: "running",
      created: new Date(now.getTime() + 20 * 60 * 1000),
    },
  ]);
}

function renderWorkflowsRoute(server: TestServer, session: TestSession) {
  setTestSession(session);
  const trpcClient = createTestClient(server, { session });
  return renderRoute(<WorkflowsRouteComponent />, { trpcClient });
}

describeE2E("Workflow route E2E", () => {
  let server: TestServer;
  let session: TestSession;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer(server);
  });

  beforeEach(async () => {
    session = createTestSession({ id: `workflow-user-${Date.now()}` });
    server.setSession(session);
    await server.reset();
    await truncateWorkflowTables(server);
    await seedWorkflowRuns(server, session);
  });

  it("renders workflow runs from the database", async () => {
    const view = renderWorkflowsRoute(server, session);

    await waitFor(() => {
      expect(view.getAllByText(/daily-sync/i).length).toBeGreaterThan(0);
      expect(view.getAllByText(/import-pipeline/i).length).toBeGreaterThan(0);
      expect(view.getAllByText(/weekly-summary/i).length).toBeGreaterThan(0);
    });
  });

  it("opens the detail modal when viewing a workflow", async () => {
    const user = userEvent.setup();
    const view = renderWorkflowsRoute(server, session);

    const viewButtons = await waitFor(() =>
      view.getAllByRole("button", { name: /view/i })
    );
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(view.getByText(/workflow details/i)).toBeTruthy();
      expect(view.getAllByText(/daily-sync/i).length).toBeGreaterThan(0);
    });
  });
});
