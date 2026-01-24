/**
 * EmbeddingVisualizer Component Tests
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

const { EmbeddingVisualizer } = await import("../embedding-visualizer");

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
  { id: "node-5", label: "Graph Query", type: "fact", relevance: 0.68 },
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
    source: "node-2",
    target: "node-3",
    type: "depends_on",
    weight: 0.75,
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
    refetch: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
});

describe("EmbeddingVisualizer", () => {
  describe("rendering", () => {
    it("renders 2D projection title", () => {
      const { getByText } = render(<EmbeddingVisualizer />, {
        wrapper: Wrapper,
      });
      expect(getByText("2D Projection")).toBeTruthy();
    });

    it("renders search input", () => {
      const { getByPlaceholderText } = render(<EmbeddingVisualizer />, {
        wrapper: Wrapper,
      });
      expect(getByPlaceholderText("Search embeddings...")).toBeTruthy();
    });

    it("renders canvas element", () => {
      const { container } = render(<EmbeddingVisualizer />, {
        wrapper: Wrapper,
      });
      expect(container.querySelector("canvas")).toBeTruthy();
    });

    it("shows loading state", () => {
      (trpc.graph.getGraphVisualization.useQuery as Mock).mockReturnValue({
        data: null,
        isLoading: true,
        refetch: vi.fn(),
      });
      const { container } = render(<EmbeddingVisualizer />, {
        wrapper: Wrapper,
      });
      expect(
        container.querySelectorAll(".animate-spin").length
      ).toBeGreaterThan(0);
    });
  });

  describe("statistics display", () => {
    it("shows total points count", () => {
      const { getByText } = render(<EmbeddingVisualizer />, {
        wrapper: Wrapper,
      });
      expect(getByText("5")).toBeTruthy();
      expect(getByText("Total Points")).toBeTruthy();
    });

    it("shows node types count", () => {
      const { getByText } = render(<EmbeddingVisualizer />, {
        wrapper: Wrapper,
      });
      expect(getByText("Node Types")).toBeTruthy();
      expect(getByText("3")).toBeTruthy();
    });

    it("shows edges count", () => {
      const { getByText } = render(<EmbeddingVisualizer />, {
        wrapper: Wrapper,
      });
      expect(getByText("Edges")).toBeTruthy();
      expect(getByText("2")).toBeTruthy();
    });

    it("shows search type label", () => {
      const { getByText } = render(<EmbeddingVisualizer />, {
        wrapper: Wrapper,
      });
      expect(getByText("semantic")).toBeTruthy();
      expect(getByText("Search Type")).toBeTruthy();
    });
  });

  describe("legend display", () => {
    it("shows node type legend based on data", () => {
      const { getByText } = render(<EmbeddingVisualizer />, {
        wrapper: Wrapper,
      });
      expect(getByText("fact")).toBeTruthy();
      expect(getByText("insight")).toBeTruthy();
      expect(getByText("pattern")).toBeTruthy();
    });

    it("limits legend to 4 types", () => {
      const manyTypeNodes = [
        { id: "1", label: "A", type: "type1", relevance: 0.9 },
        { id: "2", label: "B", type: "type2", relevance: 0.8 },
        { id: "3", label: "C", type: "type3", relevance: 0.7 },
        { id: "4", label: "D", type: "type4", relevance: 0.6 },
        { id: "5", label: "E", type: "type5", relevance: 0.5 },
      ];
      (trpc.graph.getGraphVisualization.useQuery as Mock).mockReturnValue({
        data: { nodes: manyTypeNodes, edges: [] },
        isLoading: false,
        refetch: vi.fn(),
      });

      const { getByText, queryByText } = render(<EmbeddingVisualizer />, {
        wrapper: Wrapper,
      });
      expect(getByText("type1")).toBeTruthy();
      expect(getByText("type4")).toBeTruthy();
      expect(queryByText("type5")).toBeNull();
    });
  });

  describe("search functionality", () => {
    it("updates search query on input", () => {
      const { getByPlaceholderText } = render(<EmbeddingVisualizer />, {
        wrapper: Wrapper,
      });
      const input = getByPlaceholderText("Search embeddings...");
      fireEvent.change(input, { target: { value: "cognitive" } });
      expect((input as HTMLInputElement).value).toBe("cognitive");
    });

    it("calls useQuery hook", () => {
      render(<EmbeddingVisualizer />, { wrapper: Wrapper });
      expect(trpc.graph.getGraphVisualization.useQuery).toHaveBeenCalled();
    });
  });

  describe("canvas interactions", () => {
    it("canvas has crosshair cursor", () => {
      const { container } = render(<EmbeddingVisualizer />, {
        wrapper: Wrapper,
      });
      const canvas = container.querySelector("canvas");
      expect(canvas?.className).toContain("cursor-crosshair");
    });

    it("handles mouse move on canvas", () => {
      const { container } = render(<EmbeddingVisualizer />, {
        wrapper: Wrapper,
      });
      const canvas = container.querySelector("canvas");
      expect(canvas).toBeTruthy();
      if (canvas) {
        fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });
      }
    });

    it("handles mouse leave on canvas", () => {
      const { container } = render(<EmbeddingVisualizer />, {
        wrapper: Wrapper,
      });
      const canvas = container.querySelector("canvas");
      expect(canvas).toBeTruthy();
      if (canvas) {
        fireEvent.mouseLeave(canvas);
      }
    });
  });

  describe("empty states", () => {
    it("handles empty nodes array showing zero stats", () => {
      (trpc.graph.getGraphVisualization.useQuery as Mock).mockReturnValue({
        data: { nodes: [], edges: [] },
        isLoading: false,
        refetch: vi.fn(),
      });
      const { getAllByText } = render(<EmbeddingVisualizer />, {
        wrapper: Wrapper,
      });
      expect(getAllByText("0").length).toBeGreaterThanOrEqual(1);
    });

    it("handles null data gracefully", () => {
      (trpc.graph.getGraphVisualization.useQuery as Mock).mockReturnValue({
        data: null,
        isLoading: false,
        refetch: vi.fn(),
      });
      const { container } = render(<EmbeddingVisualizer />, {
        wrapper: Wrapper,
      });
      expect(container.querySelector("canvas")).toBeTruthy();
    });
  });

  describe("loading state", () => {
    it("shows spinner during loading", () => {
      (trpc.graph.getGraphVisualization.useQuery as Mock).mockReturnValue({
        data: null,
        isLoading: true,
        refetch: vi.fn(),
      });
      const { container } = render(<EmbeddingVisualizer />, {
        wrapper: Wrapper,
      });
      expect(
        container.querySelectorAll(".animate-spin").length
      ).toBeGreaterThan(0);
    });
  });
});
