/**
 * RetrievalDebugger Component Tests
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

const { RetrievalDebugger } = await import("../retrieval-debugger");

const mockResults = [
  {
    id: "result-1",
    source: "README.md",
    content: "ALFRED is a personal AI assistant designed for developers.",
    score: 0.92,
    metadata: { section: "overview" },
  },
  {
    id: "result-2",
    source: "ARCHITECTURE.md",
    content: "The desktop shell provides a modern windowed interface.",
    score: 0.85,
    metadata: { section: "features" },
  },
  {
    id: "result-3",
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
    data: { chunks: mockResults },
    isLoading: false,
    refetch: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
});

describe("RetrievalDebugger", () => {
  describe("rendering", () => {
    it("renders search input and button", () => {
      const { getByPlaceholderText, getByText } = render(
        <RetrievalDebugger />,
        { wrapper: Wrapper }
      );
      expect(getByPlaceholderText("Enter a retrieval query...")).toBeTruthy();
      expect(getByText("Search")).toBeTruthy();
    });

    it("shows default message when no search performed", () => {
      (trpc.graph.getRagChunks.useQuery as Mock).mockReturnValue({
        data: null,
        isLoading: false,
        refetch: vi.fn(),
      });
      const { getByText } = render(<RetrievalDebugger />, { wrapper: Wrapper });
      expect(getByText("Enter a query to debug retrieval")).toBeTruthy();
    });

    it("shows loading state during search", () => {
      (trpc.graph.getRagChunks.useQuery as Mock).mockReturnValue({
        data: null,
        isLoading: true,
        refetch: vi.fn(),
      });
      const { getByPlaceholderText, getByText, container } = render(
        <RetrievalDebugger />,
        { wrapper: Wrapper }
      );

      const input = getByPlaceholderText("Enter a retrieval query...");
      fireEvent.change(input, { target: { value: "test" } });
      fireEvent.click(getByText("Search"));

      expect(
        container.querySelectorAll(".animate-spin").length
      ).toBeGreaterThan(0);
    });

    it("displays multiple buttons (search + settings)", () => {
      const { container } = render(<RetrievalDebugger />, { wrapper: Wrapper });
      expect(
        container.querySelectorAll("button").length
      ).toBeGreaterThanOrEqual(2);
    });
  });

  describe("search functionality", () => {
    it("disables search button when query is empty", () => {
      const { getByText } = render(<RetrievalDebugger />, { wrapper: Wrapper });
      const searchButton = getByText("Search").closest("button");
      expect(searchButton?.hasAttribute("disabled")).toBe(true);
    });

    it("updates input value when typing", () => {
      const { getByPlaceholderText } = render(<RetrievalDebugger />, {
        wrapper: Wrapper,
      });
      const input = getByPlaceholderText("Enter a retrieval query...");
      fireEvent.change(input, { target: { value: "test query" } });
      expect((input as HTMLInputElement).value).toBe("test query");
    });

    it("calls useQuery hook", () => {
      render(<RetrievalDebugger />, { wrapper: Wrapper });
      expect(trpc.graph.getRagChunks.useQuery).toHaveBeenCalled();
    });
  });

  describe("results display", () => {
    it("shows result count after search", () => {
      const { getByText, getByPlaceholderText } = render(
        <RetrievalDebugger />,
        { wrapper: Wrapper }
      );

      const input = getByPlaceholderText("Enter a retrieval query...");
      fireEvent.change(input, { target: { value: "test" } });
      fireEvent.click(getByText("Search"));

      expect(getByText(/3 results/)).toBeTruthy();
    });

    it("displays ranked results with position numbers", () => {
      const { getByText, getByPlaceholderText } = render(
        <RetrievalDebugger />,
        { wrapper: Wrapper }
      );

      const input = getByPlaceholderText("Enter a retrieval query...");
      fireEvent.change(input, { target: { value: "test" } });
      fireEvent.click(getByText("Search"));

      expect(getByText("1")).toBeTruthy();
      expect(getByText("2")).toBeTruthy();
      expect(getByText("3")).toBeTruthy();
    });

    it("shows relevance scores for each result", () => {
      const { getByText, getByPlaceholderText } = render(
        <RetrievalDebugger />,
        { wrapper: Wrapper }
      );

      const input = getByPlaceholderText("Enter a retrieval query...");
      fireEvent.change(input, { target: { value: "test" } });
      fireEvent.click(getByText("Search"));

      expect(getByText("92.0%")).toBeTruthy();
      expect(getByText("85.0%")).toBeTruthy();
      expect(getByText("78.0%")).toBeTruthy();
    });

    it("shows empty state when no results found", () => {
      (trpc.graph.getRagChunks.useQuery as Mock).mockReturnValue({
        data: { chunks: [] },
        isLoading: false,
        refetch: vi.fn(),
      });

      const { getByText, getByPlaceholderText } = render(
        <RetrievalDebugger />,
        { wrapper: Wrapper }
      );

      const input = getByPlaceholderText("Enter a retrieval query...");
      fireEvent.change(input, { target: { value: "nonexistent" } });
      fireEvent.click(getByText("Search"));

      expect(getByText(/No results found/)).toBeTruthy();
    });

    it("truncates long content in results", () => {
      const { container, getByText, getByPlaceholderText } = render(
        <RetrievalDebugger />,
        { wrapper: Wrapper }
      );

      const input = getByPlaceholderText("Enter a retrieval query...");
      fireEvent.change(input, { target: { value: "test" } });
      fireEvent.click(getByText("Search"));

      expect(
        container.querySelectorAll(".line-clamp-3").length
      ).toBeGreaterThan(0);
    });
  });

  describe("settings panel", () => {
    it("toggles settings panel on button click", () => {
      const { container, queryByText } = render(<RetrievalDebugger />, {
        wrapper: Wrapper,
      });

      expect(queryByText("Top-K:")).toBeNull();

      const buttons = container.querySelectorAll("button");
      const settingsButton = buttons.at(-1);
      if (settingsButton) {
        fireEvent.click(settingsButton);
      }

      expect(queryByText("Top-K:")).toBeTruthy();
    });

    it("allows changing Top-K value", () => {
      const { container } = render(<RetrievalDebugger />, { wrapper: Wrapper });

      const buttons = container.querySelectorAll("button");
      const settingsButton = buttons.at(-1);
      if (settingsButton) {
        fireEvent.click(settingsButton);
      }

      const topKInput = container.querySelector('input[type="number"]');
      expect(topKInput).toBeTruthy();
      if (topKInput) {
        fireEvent.change(topKInput, { target: { value: "15" } });
        expect((topKInput as HTMLInputElement).value).toBe("15");
      }
    });
  });

  describe("visual indicators", () => {
    it("shows score progress bars for results", () => {
      const { container, getByText, getByPlaceholderText } = render(
        <RetrievalDebugger />,
        { wrapper: Wrapper }
      );

      const input = getByPlaceholderText("Enter a retrieval query...");
      fireEvent.change(input, { target: { value: "test" } });
      fireEvent.click(getByText("Search"));

      expect(container.querySelectorAll(".bg-biolum").length).toBeGreaterThan(
        0
      );
    });
  });
});
