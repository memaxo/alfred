import "@/test/dom";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "bun:test";

vi.mock("@/utils/trpc", () => ({
  trpc: {
    knowledge: {
      stats: {
        useQuery: () => ({
          data: { totalNodes: 0, relations: 0 },
        }),
      },
      entitiesList: {
        useQuery: () => ({
          data: { entities: [] },
          isLoading: false,
        }),
      },
      insightsList: {
        useQuery: () => ({
          data: { insights: [] },
        }),
      },
    },
  },
}));

const desktopState = {
  spawnWindow: vi.fn(),
  setMode: vi.fn(),
  setFocusedWindow: vi.fn(),
  restoreWindow: vi.fn(),
  focusWindow: vi.fn(),
};

vi.mock("@/store/desktop", () => ({
  useDesktopStore: (selector: (s: typeof desktopState) => unknown) =>
    selector(desktopState),
}));

const mindscapeState = {
  nodes: [],
  edges: [],
  onNodesChange: vi.fn(),
  onEdgesChange: vi.fn(),
  selectNode: vi.fn(),
  addNode: vi.fn(),
  deactivate: vi.fn(),
  removeNode: vi.fn(),
};

vi.mock("@/store/mindscape", () => ({
  useMindscapeStore: (selector: (s: typeof mindscapeState) => unknown) =>
    selector(mindscapeState),
}));

import { MindscapeCanvas } from "./canvas";

describe("MindscapeCanvas", () => {
  it("should render canvas with ReactFlowProvider", () => {
    const { getByText } = render(<MindscapeCanvas />);

    expect(getByText(/knowledge graph/i)).toBeTruthy();
  });

  it("should render search input", () => {
    const { getByPlaceholderText } = render(<MindscapeCanvas />);

    expect(getByPlaceholderText(/search entities/i)).toBeTruthy();
  });

  it("should render stats panel", () => {
    const { getByText } = render(<MindscapeCanvas />);

    expect(getByText(/entities/i)).toBeTruthy();
    expect(getByText(/relations/i)).toBeTruthy();
  });
});
