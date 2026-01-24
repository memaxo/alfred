/**
 * SimilarityExplorer Component Tests
 */

import "@/test/dom";
import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "bun:test";

import { trpc } from "@/utils/trpc";

vi.mock("@/utils/trpc", () => ({
  trpc: {
    graph: {
      getGraphVisualization: { useQuery: vi.fn() },
    },
  },
}));

const { SimilarityExplorer } = await import("../similarity-explorer");

const mockNodes = [
  { id: "node-1", label: "ALFRED Overview", type: "fact", relevance: 0.95 },
  { id: "node-2", label: "Desktop Shell", type: "fact", relevance: 0.88 },
  { id: "node-3", label: "Cognitive Loop", type: "insight", relevance: 0.82 },
  {
    id: "node-4",
    label: "ReactFlow Isolation",
    type: "pattern",
    relevance: 0.75,
  },
];

const mockEdges = [
  {
    id: "edge-1",
    source: "node-1",
    target: "node-2",
    type: "relates_to",
    weight: 0.89,
  },
  {
    id: "edge-2",
    source: "node-1",
    target: "node-3",
    type: "depends_on",
    weight: 0.82,
  },
  {
    id: "edge-3",
    source: "node-2",
    target: "node-4",
    type: "blocks",
    weight: 0.71,
  },
  {
    id: "edge-4",
    source: "node-3",
    target: "node-4",
    type: "is_a",
    weight: 0.45,
  },
];

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
  (trpc.graph.getGraphVisualization.useQuery as Mock).mockReturnValue({
    data: { nodes: mockNodes, edges: mockEdges },
    isLoading: false,
  });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
});

describe("SimilarityExplorer", () => {
  describe("rendering", () => {
    it("renders similarity pairs header", () => {
      const { getByText } = render(<SimilarityExplorer />, {
        wrapper: Wrapper,
      });
      expect(getByText("Similarity Pairs")).toBeTruthy();
    });

    it("renders search input", () => {
      const { getByPlaceholderText } = render(<SimilarityExplorer />, {
        wrapper: Wrapper,
      });
      expect(getByPlaceholderText("Search graph...")).toBeTruthy();
    });

    it("shows loading state", () => {
      (trpc.graph.getGraphVisualization.useQuery as Mock).mockReturnValue({
        data: null,
        isLoading: true,
      });
      const { container } = render(<SimilarityExplorer />, {
        wrapper: Wrapper,
      });
      expect(
        container.querySelectorAll(".animate-spin").length
      ).toBeGreaterThan(0);
    });

    it("shows empty state when no relationships", () => {
      (trpc.graph.getGraphVisualization.useQuery as Mock).mockReturnValue({
        data: { nodes: [], edges: [] },
        isLoading: false,
      });
      const { getByText } = render(<SimilarityExplorer />, {
        wrapper: Wrapper,
      });
      expect(getByText(/No relationships found/)).toBeTruthy();
    });
  });

  describe("similarity pairs display", () => {
    it("renders pairs from graph edges", () => {
      const { getAllByText } = render(<SimilarityExplorer />, {
        wrapper: Wrapper,
      });
      expect(getAllByText("ALFRED Overview").length).toBeGreaterThan(0);
      expect(getAllByText("Desktop Shell").length).toBeGreaterThan(0);
    });

    it("displays similarity percentages", () => {
      const { getAllByText } = render(<SimilarityExplorer />, {
        wrapper: Wrapper,
      });
      expect(getAllByText("89%").length).toBeGreaterThan(0);
      expect(getAllByText("82%").length).toBeGreaterThan(0);
    });

    it("shows edge types on pair cards", () => {
      const { getByText } = render(<SimilarityExplorer />, {
        wrapper: Wrapper,
      });
      expect(getByText("relates_to")).toBeTruthy();
      expect(getByText("depends_on")).toBeTruthy();
    });

    it("sorts pairs by similarity score descending", () => {
      const { getAllByText } = render(<SimilarityExplorer />, {
        wrapper: Wrapper,
      });
      const percentages = getAllByText(/%$/).map((el) => el.textContent);
      const scores = percentages.map((p) =>
        Number.parseInt(p?.replace("%", "") ?? "0", 10)
      );
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]!);
      }
    });
  });

  describe("pair selection", () => {
    it("shows default message when no pair selected", () => {
      const { getByText } = render(<SimilarityExplorer />, {
        wrapper: Wrapper,
      });
      expect(
        getByText("Select a pair to view similarity details")
      ).toBeTruthy();
    });

    it("displays pair details on selection", () => {
      const { getAllByText, getByText } = render(<SimilarityExplorer />, {
        wrapper: Wrapper,
      });

      const pairButtons = getAllByText("ALFRED Overview")
        .map((el) => el.closest("button"))
        .filter(Boolean);
      if (pairButtons[0]) {
        fireEvent.click(pairButtons[0]);
      }

      expect(getByText("Cosine Similarity")).toBeTruthy();
      expect(getByText("Relationship Info")).toBeTruthy();
    });

    it("shows percentage in detail view", () => {
      const { getAllByText, getByText } = render(<SimilarityExplorer />, {
        wrapper: Wrapper,
      });

      const pairButtons = getAllByText("ALFRED Overview")
        .map((el) => el.closest("button"))
        .filter(Boolean);
      if (pairButtons[0]) {
        fireEvent.click(pairButtons[0]);
      }

      expect(getByText("89.0%")).toBeTruthy();
    });

    it("displays node labels in detail grid", () => {
      const { getAllByText } = render(<SimilarityExplorer />, {
        wrapper: Wrapper,
      });

      const pairButtons = getAllByText("ALFRED Overview")
        .map((el) => el.closest("button"))
        .filter(Boolean);
      if (pairButtons[0]) {
        fireEvent.click(pairButtons[0]);
      }

      expect(getAllByText("ALFRED Overview").length).toBeGreaterThanOrEqual(2);
      expect(getAllByText("Desktop Shell").length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("search functionality", () => {
    it("updates query on input change", () => {
      const { getByPlaceholderText } = render(<SimilarityExplorer />, {
        wrapper: Wrapper,
      });
      const input = getByPlaceholderText("Search graph...");
      fireEvent.change(input, { target: { value: "cognitive" } });
      expect((input as HTMLInputElement).value).toBe("cognitive");
    });

    it("uses the query hook", () => {
      render(<SimilarityExplorer />, { wrapper: Wrapper });
      expect(trpc.graph.getGraphVisualization.useQuery).toHaveBeenCalled();
    });
  });

  describe("relationship info", () => {
    it("shows edge type in detail view", () => {
      const { getAllByText, getByText } = render(<SimilarityExplorer />, {
        wrapper: Wrapper,
      });

      const pairButtons = getAllByText("ALFRED Overview")
        .map((el) => el.closest("button"))
        .filter(Boolean);
      if (pairButtons[0]) {
        fireEvent.click(pairButtons[0]);
      }

      expect(getByText("Type")).toBeTruthy();
      expect(getByText("Weight")).toBeTruthy();
    });

    it("displays connection strength progress bar", () => {
      const { getAllByText, container } = render(<SimilarityExplorer />, {
        wrapper: Wrapper,
      });

      const pairButtons = getAllByText("ALFRED Overview")
        .map((el) => el.closest("button"))
        .filter(Boolean);
      if (pairButtons[0]) {
        fireEvent.click(pairButtons[0]);
      }

      expect(container.querySelectorAll(".bg-biolum").length).toBeGreaterThan(
        0
      );
    });
  });

  describe("edge cases", () => {
    it("handles edges with missing nodes gracefully", () => {
      (trpc.graph.getGraphVisualization.useQuery as Mock).mockReturnValue({
        data: {
          nodes: mockNodes,
          edges: [
            {
              id: "edge-1",
              source: "node-1",
              target: "nonexistent",
              type: "relates_to",
              weight: 0.89,
            },
          ],
        },
        isLoading: false,
      });
      const { queryByText } = render(<SimilarityExplorer />, {
        wrapper: Wrapper,
      });
      expect(queryByText("nonexistent")).toBeNull();
    });

    it("handles empty nodes array", () => {
      (trpc.graph.getGraphVisualization.useQuery as Mock).mockReturnValue({
        data: { nodes: [], edges: mockEdges },
        isLoading: false,
      });
      const { getByText } = render(<SimilarityExplorer />, {
        wrapper: Wrapper,
      });
      expect(getByText(/No relationships found/)).toBeTruthy();
    });
  });
});
