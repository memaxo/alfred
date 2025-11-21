import { describe, it, expect, mock } from "bun:test";
import "../../test/testing-library";

import {
  renderRoute,
  createTestTrpcClient,
  type TestTrpcHandlers,
} from "@/test/render-route";

describe("MindscapeCanvas graph integration", () => {
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
        "graph.runQuery": () => ({
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
        }),
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

    const node = await findByText("Runtime Insight Node");
    expect(node).toBeTruthy();
  });
});
