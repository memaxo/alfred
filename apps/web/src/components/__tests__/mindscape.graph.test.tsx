import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../../test/testing-library";

// Mock physics worker for Bun test environment
mock.module("@/workers/physics.worker?worker", () => ({
  default: class MockWorker {
    postMessage() {}
    terminate() {}
    onmessage = null;
  },
}));

mock.module("@/hooks/use-physics-worker", () => ({
  usePhysicsWorker: () => ({
    ready: true,
    running: false,
    start: () => {},
    stop: () => {},
    addNode: () => {},
    removeNode: () => {},
    setFixed: () => {},
  }),
}));

import { useMindscapeStore } from "@/store/mindscape";
import {
  createTestTrpcClient,
  renderRoute,
  type TestTrpcHandlers,
} from "@/test/render-route";

describe("MindscapeCanvas graph integration", () => {
  beforeEach(() => {
    if (typeof process !== "undefined") {
      process.env.MINDSCAPE_DISABLE_CHAT_AUTOSPAWN = "1";
    }

    // Reset Mindscape store between tests to avoid persisted chat/other nodes
    useMindscapeStore.setState({
      nodes: [],
      edges: [],
      focusedNodeId: null,
      isSpaceMode: false,
      ragDocCache: {},
      ragDocCacheStats: { hits: 0, misses: 0, evictions: 0 },
      contextCache: {},
    });
  });

  it("renders knowledge nodes from graph.runQuery results", async () => {
    const { MindscapeCanvas } = await import("@/components/mindscape/canvas");
    const handlers: TestTrpcHandlers = {
      queries: {
        "note.list": () => [
          {
            id: "00000000-0000-0000-0000-000000000001",
            title: "Graph Note",
            content: "Graph note content",
            tags: [],
            updatedAt: new Date(),
          },
        ],
        "remind.due": () => [],
        "graph.getEdges": () => [
          {
            id: "edge-explains-1",
            fromId: "rag-doc-1",
            toId: "00000000-0000-0000-0000-000000000001",
            kind: "explains",
            weight: 1,
            resource: "user",
            metadata: { documentId: "doc-1" },
            created: new Date(),
          },
        ],
        "graph.runQuery": (input) => {
          const query = input as { kind?: string };
          if (query.kind === "traverse") {
            return {
              nodes: [
                {
                  id: { dbId: "00000000-0000-0000-0000-000000000001" },
                  kind: "fact",
                  label: "Runtime Insight Node",
                  properties: {
                    content: "Integration node content",
                    confidence: 0.9,
                  },
                },
              ],
              edges: [],
            };
          }

          if (query.kind === "semantic") {
            return {
              nodes: [
                {
                  id: { uiId: "rag-doc-1" },
                  kind: "insight",
                  label: "RAG Context Node",
                  properties: {
                    content: "RAG-backed knowledge snippet",
                  },
                },
              ],
              edges: [
                {
                  id: "edge-explains-1",
                  fromId: "rag-doc-1",
                  toId: "00000000-0000-0000-0000-000000000001",
                  kind: "explains",
                  weight: 1,
                  resource: "user",
                  metadata: { documentId: "doc-1" },
                },
              ],
            };
          }

          return { nodes: [], edges: [] };
        },
      },
      subscriptions: {
        "graph.watchEdges": (_input, observer) => {
          observer.complete();
        },
      },
    };

    const trpcClient = createTestTrpcClient(handlers);

    const { findAllByText } = renderRoute(<MindscapeCanvas />, {
      trpcClient,
    });

    const runtimeNodes = await findAllByText("Runtime Insight Node");
    expect(runtimeNodes.length).toBeGreaterThan(0);

    const ragNodes = await findAllByText("RAG Context Node");
    expect(ragNodes.length).toBeGreaterThan(0);

    // The presence of both nodes and a stable render with explains edges
    // is sufficient; React Flow does not expose edges with simple text labels.
  });
});
