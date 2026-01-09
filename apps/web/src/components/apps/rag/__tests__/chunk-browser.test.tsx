/**
 * ChunkBrowser Component Tests
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
    },
  },
}));

const { ChunkBrowser } = await import("../chunk-browser");

const mockChunks = [
  {
    id: "chunk-1",
    source: "README.md",
    content: "ALFRED is a personal AI assistant designed for developers.",
    score: 0.92,
    metadata: { section: "overview", lastUpdated: "2024-01-01" },
  },
  {
    id: "chunk-2",
    source: "ARCHITECTURE.md",
    content: "The desktop shell provides a modern windowed interface.",
    score: 0.85,
    metadata: { section: "features" },
  },
  {
    id: "chunk-3",
    source: "COGNITIVE.md",
    content: "The cognitive loop manages state transitions.",
    score: 0.78,
    metadata: {},
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
  (trpc.graph.getRagChunks.useQuery as Mock).mockReturnValue({
    data: { chunks: mockChunks },
    isLoading: false,
    refetch: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
});

describe("ChunkBrowser", () => {
  describe("rendering", () => {
    it("renders chunk list from API", () => {
      const { getByText } = render(<ChunkBrowser />, { wrapper: Wrapper });
      expect(getByText("README.md")).toBeTruthy();
      expect(getByText("ARCHITECTURE.md")).toBeTruthy();
      expect(getByText("COGNITIVE.md")).toBeTruthy();
    });

    it("shows loading state", () => {
      (trpc.graph.getRagChunks.useQuery as Mock).mockReturnValue({
        data: null,
        isLoading: true,
        refetch: vi.fn(),
      });
      const { container } = render(<ChunkBrowser />, { wrapper: Wrapper });
      expect(
        container.querySelectorAll(".animate-spin").length
      ).toBeGreaterThan(0);
    });

    it("shows empty state when no chunks", () => {
      (trpc.graph.getRagChunks.useQuery as Mock).mockReturnValue({
        data: { chunks: [] },
        isLoading: false,
        refetch: vi.fn(),
      });
      const { getByText } = render(<ChunkBrowser />, { wrapper: Wrapper });
      expect(getByText(/No chunks found/)).toBeTruthy();
    });

    it("displays relevance scores on chunk cards", () => {
      const { getByText } = render(<ChunkBrowser />, { wrapper: Wrapper });
      expect(getByText("92%")).toBeTruthy();
      expect(getByText("85%")).toBeTruthy();
      expect(getByText("78%")).toBeTruthy();
    });

    it("renders search input with placeholder", () => {
      const { getByPlaceholderText } = render(<ChunkBrowser />, {
        wrapper: Wrapper,
      });
      expect(getByPlaceholderText("Semantic search chunks...")).toBeTruthy();
    });
  });

  describe("chunk selection", () => {
    it("selects chunk on click and shows details", () => {
      const { getByText } = render(<ChunkBrowser />, { wrapper: Wrapper });

      const chunkContent = getByText(
        "ALFRED is a personal AI assistant designed for developers."
      );
      const btn = chunkContent.closest("button");
      if (btn) {
        fireEvent.click(btn);
      }

      expect(getByText("chunk-1")).toBeTruthy();
      expect(getByText("92.0%")).toBeTruthy();
    });

    it("shows default message when no chunk selected", () => {
      const { getByText } = render(<ChunkBrowser />, { wrapper: Wrapper });
      expect(getByText("Select a chunk to view details")).toBeTruthy();
    });

    it("displays chunk metadata in detail view", () => {
      const { getByText } = render(<ChunkBrowser />, { wrapper: Wrapper });

      const chunkContent = getByText(
        "ALFRED is a personal AI assistant designed for developers."
      );
      const btn = chunkContent.closest("button");
      if (btn) {
        fireEvent.click(btn);
      }

      expect(getByText("Source")).toBeTruthy();
      expect(getByText("Content")).toBeTruthy();
      expect(getByText("Metadata")).toBeTruthy();
      expect(getByText("overview")).toBeTruthy();
    });
  });

  describe("search functionality", () => {
    it("updates search query on input", () => {
      const { getByPlaceholderText } = render(<ChunkBrowser />, {
        wrapper: Wrapper,
      });
      const input = getByPlaceholderText("Semantic search chunks...");
      fireEvent.change(input, { target: { value: "cognitive" } });
      expect((input as HTMLInputElement).value).toBe("cognitive");
    });

    it("calls useQuery hook", () => {
      render(<ChunkBrowser />, { wrapper: Wrapper });
      expect(trpc.graph.getRagChunks.useQuery).toHaveBeenCalled();
    });
  });

  describe("content display", () => {
    it("truncates long content in list view", () => {
      const { container } = render(<ChunkBrowser />, { wrapper: Wrapper });
      expect(
        container.querySelectorAll(".line-clamp-2").length
      ).toBeGreaterThan(0);
    });

    it("shows full content in detail view", () => {
      const { getByText, container } = render(<ChunkBrowser />, {
        wrapper: Wrapper,
      });

      const chunkContent = getByText(
        "ALFRED is a personal AI assistant designed for developers."
      );
      const btn = chunkContent.closest("button");
      if (btn) {
        fireEvent.click(btn);
      }

      expect(container.querySelector(".whitespace-pre-wrap")).toBeTruthy();
    });

    it("handles missing metadata gracefully", () => {
      const { getByText, getAllByText } = render(<ChunkBrowser />, {
        wrapper: Wrapper,
      });

      const chunkContent = getByText(
        "The cognitive loop manages state transitions."
      );
      const btn = chunkContent.closest("button");
      if (btn) {
        fireEvent.click(btn);
      }

      const dashes = getAllByText("—");
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });
  });
});
