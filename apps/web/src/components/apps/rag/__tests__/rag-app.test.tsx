/**
 * RagApp Component Tests
 */

import "@/test/dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { trpc } from "@/utils/trpc";

vi.mock("@/utils/trpc", () => ({
  trpc: {
    graph: {
      getRagChunks: { useQuery: vi.fn() },
      getGraphVisualization: { useQuery: vi.fn() },
    },
  },
}));

const { RagApp, RagAppWindow } = await import("../index");

const mockChunks = [
  {
    id: "chunk-1",
    source: "README.md",
    content: "ALFRED is a personal AI assistant.",
    score: 0.92,
    metadata: { section: "overview" },
  },
];

const mockGraphData = {
  nodes: [{ id: "node-1", label: "Test Node", type: "fact", relevance: 0.9 }],
  edges: [
    {
      id: "edge-1",
      source: "node-1",
      target: "node-1",
      type: "relates_to",
      weight: 0.8,
    },
  ],
};

let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  vi.clearAllMocks();

  (trpc.graph.getRagChunks.useQuery as Mock).mockReturnValue({
    data: { chunks: mockChunks },
    isLoading: false,
    refetch: vi.fn(),
  });

  (trpc.graph.getGraphVisualization.useQuery as Mock).mockReturnValue({
    data: mockGraphData,
    isLoading: false,
    refetch: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
});

describe("RagApp", () => {
  describe("rendering", () => {
    it("renders RAG Explorer title", () => {
      const { getByText } = render(<RagApp window={{} as any} />, {
        wrapper: Wrapper,
      });
      expect(getByText("RAG Explorer")).toBeTruthy();
    });

    it("renders all tab buttons", () => {
      const { getByText } = render(<RagApp window={{} as any} />, {
        wrapper: Wrapper,
      });
      expect(getByText("Chunks")).toBeTruthy();
      expect(getByText("Embeddings")).toBeTruthy();
      expect(getByText("Debug")).toBeTruthy();
      expect(getByText("Similarity")).toBeTruthy();
    });

    it("shows Chunks tab by default", () => {
      const { getByText } = render(<RagApp window={{} as any} />, {
        wrapper: Wrapper,
      });
      const chunksTab = getByText("Chunks").closest("button");
      expect(chunksTab?.className).toContain("border-biolum");
    });
  });

  describe("tab navigation", () => {
    it("switches to Embeddings tab on click", () => {
      const { getByText } = render(<RagApp window={{} as any} />, {
        wrapper: Wrapper,
      });
      const embeddingsTab = getByText("Embeddings");
      fireEvent.click(embeddingsTab);
      expect(embeddingsTab.closest("button")?.className).toContain(
        "border-biolum"
      );
    });

    it("switches to Debug tab on click", () => {
      const { getByText } = render(<RagApp window={{} as any} />, {
        wrapper: Wrapper,
      });
      const debugTab = getByText("Debug");
      fireEvent.click(debugTab);
      expect(debugTab.closest("button")?.className).toContain("border-biolum");
    });

    it("switches to Similarity tab on click", () => {
      const { getByText } = render(<RagApp window={{} as any} />, {
        wrapper: Wrapper,
      });
      const similarityTab = getByText("Similarity");
      fireEvent.click(similarityTab);
      expect(similarityTab.closest("button")?.className).toContain(
        "border-biolum"
      );
    });

    it("deactivates previous tab when switching", () => {
      const { getByText } = render(<RagApp window={{} as any} />, {
        wrapper: Wrapper,
      });
      fireEvent.click(getByText("Embeddings"));
      const chunksTab = getByText("Chunks").closest("button");
      expect(chunksTab?.className).not.toContain("border-biolum");
    });
  });

  describe("content rendering", () => {
    it("renders ChunkBrowser content when Chunks tab active", () => {
      const { getByPlaceholderText } = render(<RagApp window={{} as any} />, {
        wrapper: Wrapper,
      });
      expect(getByPlaceholderText("Semantic search chunks...")).toBeTruthy();
    });

    it("renders EmbeddingVisualizer content when Embeddings tab active", () => {
      const { getByText } = render(<RagApp window={{} as any} />, {
        wrapper: Wrapper,
      });
      fireEvent.click(getByText("Embeddings"));
      expect(getByText("2D Projection")).toBeTruthy();
    });

    it("renders RetrievalDebugger content when Debug tab active", () => {
      const { getByText, getByPlaceholderText } = render(
        <RagApp window={{} as any} />,
        { wrapper: Wrapper }
      );
      fireEvent.click(getByText("Debug"));
      expect(getByPlaceholderText("Enter a retrieval query...")).toBeTruthy();
    });

    it("renders SimilarityExplorer content when Similarity tab active", () => {
      const { getByText } = render(<RagApp window={{} as any} />, {
        wrapper: Wrapper,
      });
      fireEvent.click(getByText("Similarity"));
      expect(getByText("Similarity Pairs")).toBeTruthy();
    });
  });

  describe("tab icons", () => {
    it("displays Database icon for Chunks tab", () => {
      const { container } = render(<RagApp window={{} as any} />, {
        wrapper: Wrapper,
      });
      expect(
        container.querySelectorAll("svg.lucide-database").length
      ).toBeGreaterThan(0);
    });

    it("displays Eye icon for Embeddings tab", () => {
      const { container } = render(<RagApp window={{} as any} />, {
        wrapper: Wrapper,
      });
      expect(
        container.querySelectorAll("svg.lucide-eye").length
      ).toBeGreaterThan(0);
    });

    it("displays Bug icon for Debug tab", () => {
      const { container } = render(<RagApp window={{} as any} />, {
        wrapper: Wrapper,
      });
      expect(
        container.querySelectorAll("svg.lucide-bug").length
      ).toBeGreaterThan(0);
    });

    it("displays Network icon for Similarity tab", () => {
      const { container } = render(<RagApp window={{} as any} />, {
        wrapper: Wrapper,
      });
      expect(
        container.querySelectorAll("svg.lucide-network").length
      ).toBeGreaterThan(0);
    });
  });

  describe("window component", () => {
    it("RagAppWindow renders RagApp", () => {
      const { getByText } = render(<RagAppWindow window={{} as any} />, {
        wrapper: Wrapper,
      });
      expect(getByText("RAG Explorer")).toBeTruthy();
    });
  });

  describe("layout", () => {
    it("has full height container", () => {
      const { container } = render(<RagApp window={{} as any} />, {
        wrapper: Wrapper,
      });
      const mainContainer = container.firstChild as HTMLElement;
      expect(mainContainer?.className).toContain("h-full");
    });

    it("has toolbar with fixed height", () => {
      const { container } = render(<RagApp window={{} as any} />, {
        wrapper: Wrapper,
      });
      expect(container.querySelector(".h-10")).toBeTruthy();
    });

    it("has overflow-auto content area", () => {
      const { container } = render(<RagApp window={{} as any} />, {
        wrapper: Wrapper,
      });
      expect(container.querySelector(".overflow-auto")).toBeTruthy();
    });
  });

  describe("accessibility", () => {
    it("tabs are buttons with type button", () => {
      const { getByText } = render(<RagApp window={{} as any} />, {
        wrapper: Wrapper,
      });
      const chunksTab = getByText("Chunks").closest("button");
      expect(chunksTab?.getAttribute("type")).toBe("button");
    });
  });
});
