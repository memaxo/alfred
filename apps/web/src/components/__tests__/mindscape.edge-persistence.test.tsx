import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import "../../test/testing-library";

const toastErrorMock = vi.fn();

mock.module("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: vi.fn(),
    message: vi.fn(),
  },
}));

mock.module("@/hooks/use-physics-worker", () => ({
  usePhysicsWorker: () => {},
}));

mock.module("@/hooks/use-mindscape-activations", () => ({
  useMindscapeActivations: () => {},
  dispatchMindscapeEvent: () => {},
}));

mock.module("@/hooks/use-mindscape-traversal", () => ({
  useMindscapeTraversal: () => ({ isFetching: false }),
}));

mock.module("@xyflow/react", async () => {
  const React = await import("react");

  const addEdge = (connection: any, edges: any[]) => {
    const source = String(connection?.source ?? "");
    const target = String(connection?.target ?? "");
    const id = `e-${source}-${target}`;
    return [...edges, { id, source, target, type: "default" }];
  };

  const applyEdgeChanges = (_changes: any[], edges: any[]) => edges;
  const applyNodeChanges = (_changes: any[], nodes: any[]) => nodes;

  const ReactFlow = (props: any) => {
    (globalThis as any).__rfProps = props;
    return React.createElement(
      "div",
      { "data-testid": "reactflow" },
      props.children
    );
  };

  const ReactFlowProvider = ({ children }: any) =>
    React.createElement(React.Fragment, null, children);

  const useReactFlow = () => ({
    fitView: () => {},
  });

  const Panel = ({ children }: any) =>
    React.createElement("div", null, children);

  const Handle = (_props: any) => null;
  const Controls = (_props: any) => null;
  const MiniMap = (_props: any) => null;
  const Background = (_props: any) => null;
  const BaseEdge = (_props: any) => null;
  const NodeToolbar = ({ children }: any) =>
    React.createElement(React.Fragment, null, children);

  const getSmoothStepPath = () => ["", 0, 0] as const;

  const Position = {
    Left: "left",
    Right: "right",
    Top: "top",
    Bottom: "bottom",
  } as const;

  const BackgroundVariant = {
    Dots: "dots",
  } as const;

  const useStore = () => ({});

  return {
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    Panel,
    ReactFlow,
    ReactFlowProvider,
    useReactFlow,
    addEdge,
    applyEdgeChanges,
    applyNodeChanges,
    Handle,
    Position,
    NodeToolbar,
    BaseEdge,
    getSmoothStepPath,
    useStore,
  };
});

describe("MindscapeCanvas edge persistence", () => {
  const NOTE_DBID = "11111111-1111-1111-1111-111111111111";
  const REMINDER_DBID = "22222222-2222-2222-2222-222222222222";

  beforeEach(async () => {
    toastErrorMock.mockReset();

    const { useMindscapeStore } = await import("@/store/mindscape");
    useMindscapeStore.setState({
      nodes: [
        {
          id: "note-ui",
          type: "artifact",
          position: { x: 0, y: 0 },
          data: {
            type: "note",
            label: "Note",
            noteId: "00000000-0000-0000-0000-000000000001",
            graph: { resource: "user", dbId: NOTE_DBID },
          },
        },
        {
          id: "reminder-ui",
          type: "artifact",
          position: { x: 200, y: 0 },
          data: {
            type: "reminder",
            label: "Reminder",
            reminderId: "00000000-0000-0000-0000-000000000002",
            graph: { resource: "user", dbId: REMINDER_DBID },
          },
        },
      ],
      edges: [],
      focusedNodeId: null,
      isSpaceMode: false,
      ragDocCache: {},
      ragDocCacheStats: { hits: 0, misses: 0, evictions: 0 },
      contextCache: {},
    });
  });

  it("persists new edges via graph.connect using graph dbIds", async () => {
    const connectCalls: any[] = [];

    const { MindscapeCanvas } = await import("@/components/mindscape/canvas");
    const { createTestTrpcClient, renderRoute } = await import(
      "@/test/render-route"
    );

    const handlers = {
      queries: {
        "note.list": () => [],
        "remind.due": () => [],
        "graph.getEdges": () => [],
        "graph.runQuery": () => ({ nodes: [], edges: [] }),
      },
      mutations: {
        "graph.connect": (input: unknown) => {
          connectCalls.push(input);
          return {
            id: "edge-1",
            fromId: NOTE_DBID,
            toId: REMINDER_DBID,
            kind: "relates_to",
            resource: "user",
          };
        },
      },
      subscriptions: {
        "graph.watchEdges": (_input: unknown, observer: any) => {
          observer.complete();
        },
      },
    };

    const trpcClient = createTestTrpcClient(handlers as any);
    renderRoute(<MindscapeCanvas />, { trpcClient });

    const props = (globalThis as any).__rfProps as {
      onConnect?: (conn: unknown) => Promise<void> | void;
    };
    expect(typeof props?.onConnect).toBe("function");

    await props.onConnect?.({ source: "note-ui", target: "reminder-ui" });

    const { useMindscapeStore } = await import("@/store/mindscape");
    expect(connectCalls.length).toBe(1);
    expect(connectCalls[0]).toMatchObject({
      fromId: NOTE_DBID,
      toId: REMINDER_DBID,
      resource: "user",
    });
    expect(useMindscapeStore.getState().edges.length).toBe(1);
  });

  it("rolls back local edges when graph.connect fails", async () => {
    const { MindscapeCanvas } = await import("@/components/mindscape/canvas");
    const { createTestTrpcClient, renderRoute } = await import(
      "@/test/render-route"
    );

    const handlers = {
      queries: {
        "note.list": () => [],
        "remind.due": () => [],
        "graph.getEdges": () => [],
        "graph.runQuery": () => ({ nodes: [], edges: [] }),
      },
      mutations: {
        "graph.connect": () => {
          throw new Error("connect_failed");
        },
      },
      subscriptions: {
        "graph.watchEdges": (_input: unknown, observer: any) => {
          observer.complete();
        },
      },
    };

    const trpcClient = createTestTrpcClient(handlers as any);
    renderRoute(<MindscapeCanvas />, { trpcClient });

    const props = (globalThis as any).__rfProps as {
      onConnect?: (conn: unknown) => Promise<void> | void;
    };

    await props.onConnect?.({ source: "note-ui", target: "reminder-ui" });

    const { useMindscapeStore } = await import("@/store/mindscape");
    expect(toastErrorMock).toHaveBeenCalledWith("Failed to persist edge.");
    expect(useMindscapeStore.getState().edges.length).toBe(0);
  });
});
