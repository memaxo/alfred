import { describe, it, expect, mock, beforeEach } from "bun:test";
import "../../test/testing-library";

import {
  renderRoute,
  createTestTrpcClient,
  type TestTrpcHandlers,
} from "@/test/render-route";
import { useMindscapeStore } from "@/store/mindscape";

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
        "graph.getEdges": () => [],
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
              edges: [],
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

    const { findByText } = renderRoute(<MindscapeCanvas />, {
      trpcClient,
    });

    const runtimeNode = await findByText("Runtime Insight Node");
    expect(runtimeNode).toBeTruthy();

    const ragNode = await findByText("RAG Context Node");
    expect(ragNode).toBeTruthy();
  });
});
