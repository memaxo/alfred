import "../../test/testing-library";
import "../../test/reset-mocks";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { useMindscapeStore } from "@/store/mindscape";
import type { TestTrpcHandlers } from "@/test/render-route";
import {
  createTestQueryClient,
  createTestTrpcClient,
} from "@/test/render-route";
import { trpc } from "@/utils/trpc";
import { fireEvent, render, waitFor } from "../../test/testing-library";

mock.module("@/components/ui/dialog", () => {
  const React = require("react") as typeof import("react");
  const omitCustom = <T extends Record<string, unknown>>(props: T) => {
    const { onOpenChange, ...rest } = props as any;
    if (typeof onOpenChange === "function") {
      // no-op in tests
    }
    return rest;
  };
  const passthrough = ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...omitCustom(props)}>{children}</div>
  );
  const fragment = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  );

  return {
    Dialog: passthrough,
    DialogContent: passthrough,
    DialogHeader: passthrough,
    DialogFooter: passthrough,
    DialogTitle: passthrough,
    DialogDescription: passthrough,
    DialogClose: passthrough,
    DialogOverlay: passthrough,
    DialogPortal: fragment,
    DialogTrigger: passthrough,
  };
});

const { Route: MindscapeFileRoute } = await import("../mindscape");
const { Route: WorkflowFileRoute } = await import("../workflow.$runId");

const runtimeRunId = "run-provenance-1";

const rootRoute = createRootRouteWithContext<Record<string, never>>()({
  component: () => <Outlet />,
});

const mindscapeRoute = MindscapeFileRoute.update({
  id: "/mindscape",
  path: "/mindscape",
  getParentRoute: () => rootRoute,
});

const workflowRoute = WorkflowFileRoute.update({
  id: "/workflow/$runId",
  path: "/workflow/$runId",
  getParentRoute: () => rootRoute,
});

const routeTree = rootRoute.addChildren([mindscapeRoute, workflowRoute]);

describe("Mindscape → Workflow navigation", () => {
  beforeEach(() => {
    if (typeof process !== "undefined") {
      process.env.MINDSCAPE_DISABLE_CHAT_AUTOSPAWN = "1";
    }
    useMindscapeStore.setState((state) => ({
      ...state,
      nodes: [],
      edges: [],
      focusedNodeId: null,
      ragDocCache: {},
      ragDocCacheStats: { hits: 0, misses: 0, evictions: 0 },
    }));
  });

  it("navigates to the workflow run and renders provenance", async () => {
    const runtimeNodeId = "knowledge-runtime-test";
    useMindscapeStore.setState((state) => ({
      ...state,
      nodes: [
        {
          id: "singularity",
          type: "orb",
          position: { x: 0, y: 0 },
          data: { label: "Singularity" },
          draggable: false,
          selectable: false,
        },
        {
          id: runtimeNodeId,
          type: "knowledge",
          position: { x: 120, y: 80 },
          data: {
            type: "knowledge",
            label: "Runtime Router Node",
            source: "runtime",
            runId: runtimeRunId,
            graph: { dbId: "db-runtime-node" },
          },
          selectable: true,
          draggable: true,
        },
      ],
      focusedNodeId: runtimeNodeId,
    }));

    const handlers: TestTrpcHandlers = {
      queries: {
        "note.list": () => [],
        "remind.due": () => [],
        "graph.getEdges": () => [],
        "graph.runQuery": () => ({ nodes: [], edges: [] }),
        "graph.explainedBy": () => ({ nodes: [], edges: [] }),
        "workflow.get": () => ({
          id: runtimeRunId,
          workflowId: "workflow-1",
          status: "completed",
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          inputData: { requirement: "Router test" },
        }),
        "workflow.events": () => [
          {
            id: "evt-1",
            eventType: "step.started",
            timestamp: new Date().toISOString(),
            eventData: { note: "boot" },
          },
        ],
        "workflow.reasoning": () => ({
          runId: runtimeRunId,
          resource: "user",
          executionId: "exec-1",
          chain: [],
          provenance: {
            ragDocuments: [{ documentId: "doc-1", label: "Router Doc" }],
          },
        }),
      },
    };

    const queryClient = createTestQueryClient();
    const trpcClient = createTestTrpcClient(handlers);
    const history = createMemoryHistory({ initialEntries: ["/mindscape"] });

    const router = createRouter({
      routeTree,
      history,
      context: {},
      Wrap: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          <trpc.Provider client={trpcClient} queryClient={queryClient}>
            {children}
          </trpc.Provider>
        </QueryClientProvider>
      ),
    });

    const view = render(<RouterProvider router={router as unknown as never} />);

    const ctas = await view.findAllByTestId("mindscape-workflow-link");
    fireEvent.click(ctas[0]);

    const openFullButtons = await view.findAllByTestId(
      "mindscape-drawer-open-full"
    );
    fireEvent.click(openFullButtons.at(-1));

    await waitFor(() => {
      expect(history.location.pathname).toBe(`/workflow/${runtimeRunId}`);
      expect(router.state.location.search).toMatchObject({ drawer: "1" });
    });

    const workflowHeaders = await view.findAllByText("Workflow Details");
    expect(workflowHeaders.length).toBeGreaterThan(0);
    const routerDocs = await view.findAllByText("Router Doc");
    expect(routerDocs.length).toBeGreaterThan(0);
  });

  it("renders the provenance error copy when reasoning fails", async () => {
    const runtimeNodeId = "knowledge-runtime-error";
    useMindscapeStore.setState((state) => ({
      ...state,
      nodes: [
        {
          id: runtimeNodeId,
          type: "knowledge",
          position: { x: 0, y: 0 },
          data: {
            type: "knowledge",
            label: "Runtime Error Node",
            source: "runtime",
            runId: runtimeRunId,
          },
          selectable: true,
          draggable: true,
        },
      ],
      focusedNodeId: runtimeNodeId,
    }));

    const handlers: TestTrpcHandlers = {
      queries: {
        "note.list": () => [],
        "remind.due": () => [],
        "graph.getEdges": () => [],
        "graph.runQuery": () => ({ nodes: [], edges: [] }),
        "graph.explainedBy": () => ({ nodes: [], edges: [] }),
        "workflow.get": () => ({
          id: runtimeRunId,
          workflowId: "workflow-err",
          status: "completed",
          startedAt: new Date(),
          completedAt: new Date(),
          inputData: { requirement: "Router test" },
        }),
        "workflow.events": () => [],
        "workflow.reasoning": () => {
          throw new Error("Provenance disabled");
        },
      },
    };

    const queryClient = createTestQueryClient();
    const trpcClient = createTestTrpcClient(handlers);
    const history = createMemoryHistory({ initialEntries: ["/mindscape"] });

    const router = createRouter({
      routeTree,
      history,
      context: {},
      Wrap: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          <trpc.Provider client={trpcClient} queryClient={queryClient}>
            {children}
          </trpc.Provider>
        </QueryClientProvider>
      ),
    });

    const view = render(<RouterProvider router={router as unknown as never} />);

    const ctas = await view.findAllByTestId("mindscape-workflow-link");
    fireEvent.click(ctas[0]);

    const openFullButtons = await view.findAllByTestId(
      "mindscape-drawer-open-full"
    );
    fireEvent.click(openFullButtons.at(-1));

    await waitFor(() => {
      expect(history.location.pathname).toBe(`/workflow/${runtimeRunId}`);
      expect(router.state.location.search).toMatchObject({ drawer: "1" });
    });

    const provenanceErrors = await view.findAllByText(
      "Unable to load provenance. Please retry in a moment."
    );
    expect(provenanceErrors.length).toBeGreaterThan(0);
  });
});
