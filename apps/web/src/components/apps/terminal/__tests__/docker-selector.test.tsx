import "@/test/dom";
import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, type Mock, vi } from "bun:test";

import { trpc } from "@/utils/trpc";

const mockRefetch = vi.fn();

vi.mock("@/utils/trpc", () => ({
  trpc: {
    terminal: {
      listContainers: {
        useQuery: vi.fn(),
      },
    },
    useUtils: vi.fn(() => ({})),
  },
}));

import { DockerSelector } from "../docker-selector";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("DockerSelector", () => {
  const mockOnSelect = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnSelect.mockClear();
    mockOnClose.mockClear();
    mockRefetch.mockClear();
  });

  it("renders loading state", () => {
    (trpc.terminal.listContainers.useQuery as Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: mockRefetch,
    });

    const { container } = render(
      <DockerSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    const loader = container.querySelector(".animate-spin");
    expect(loader).toBeDefined();
  });

  it("renders empty state when no containers", () => {
    (trpc.terminal.listContainers.useQuery as Mock).mockReturnValue({
      data: [],
      isLoading: false,
      refetch: mockRefetch,
    });

    const { getByText } = render(
      <DockerSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    expect(getByText("No running containers found")).toBeDefined();
    expect(getByText("Start a container to connect")).toBeDefined();
  });

  it("renders only running containers", () => {
    (trpc.terminal.listContainers.useQuery as Mock).mockReturnValue({
      data: [
        {
          id: "abc123",
          name: "running-app",
          image: "nginx",
          status: "Up",
          state: "running",
        },
        {
          id: "def456",
          name: "stopped-app",
          image: "redis",
          status: "Exited",
          state: "exited",
        },
        {
          id: "ghi789",
          name: "another-running",
          image: "postgres",
          status: "Up",
          state: "running",
        },
      ],
      isLoading: false,
      refetch: mockRefetch,
    });

    const { getByText, queryByText } = render(
      <DockerSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    expect(getByText("running-app")).toBeDefined();
    expect(getByText("another-running")).toBeDefined();
    expect(queryByText("stopped-app")).toBeNull();
  });

  it("displays container image", () => {
    (trpc.terminal.listContainers.useQuery as Mock).mockReturnValue({
      data: [
        {
          id: "abc123",
          name: "my-app",
          image: "nginx:latest",
          status: "Up",
          state: "running",
        },
      ],
      isLoading: false,
      refetch: mockRefetch,
    });

    const { getByText } = render(
      <DockerSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    expect(getByText("nginx:latest")).toBeDefined();
  });

  it("displays running state indicator", () => {
    (trpc.terminal.listContainers.useQuery as Mock).mockReturnValue({
      data: [
        {
          id: "abc123",
          name: "my-app",
          image: "nginx",
          status: "Up",
          state: "running",
        },
      ],
      isLoading: false,
      refetch: mockRefetch,
    });

    const { getByText } = render(
      <DockerSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    expect(getByText("running")).toBeDefined();
  });

  it("calls onSelect when container clicked", () => {
    const container = {
      id: "abc123",
      name: "my-app",
      image: "nginx",
      status: "Up",
      state: "running" as const,
    };
    (trpc.terminal.listContainers.useQuery as Mock).mockReturnValue({
      data: [container],
      isLoading: false,
      refetch: mockRefetch,
    });

    const { getByText } = render(
      <DockerSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(getByText("my-app"));

    expect(mockOnSelect).toHaveBeenCalledWith(container);
  });

  it("calls onClose when close button clicked", () => {
    (trpc.terminal.listContainers.useQuery as Mock).mockReturnValue({
      data: [],
      isLoading: false,
      refetch: mockRefetch,
    });

    const { getByTitle } = render(
      <DockerSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(getByTitle("Close"));

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("calls refetch when refresh button clicked", () => {
    (trpc.terminal.listContainers.useQuery as Mock).mockReturnValue({
      data: [],
      isLoading: false,
      refetch: mockRefetch,
    });

    const { getByTitle } = render(
      <DockerSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(getByTitle("Refresh"));

    expect(mockRefetch).toHaveBeenCalled();
  });

  it("shows dialog title", () => {
    (trpc.terminal.listContainers.useQuery as Mock).mockReturnValue({
      data: [],
      isLoading: false,
      refetch: mockRefetch,
    });

    const { getByText } = render(
      <DockerSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    expect(getByText("Select Docker Container")).toBeDefined();
  });

  it("shows footer message", () => {
    (trpc.terminal.listContainers.useQuery as Mock).mockReturnValue({
      data: [],
      isLoading: false,
      refetch: mockRefetch,
    });

    const { getByText } = render(
      <DockerSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    expect(getByText("Only running containers are shown")).toBeDefined();
  });

  it("handles multiple containers with same image", () => {
    (trpc.terminal.listContainers.useQuery as Mock).mockReturnValue({
      data: [
        {
          id: "abc123",
          name: "app-1",
          image: "nginx",
          status: "Up",
          state: "running",
        },
        {
          id: "def456",
          name: "app-2",
          image: "nginx",
          status: "Up",
          state: "running",
        },
      ],
      isLoading: false,
      refetch: mockRefetch,
    });

    const { getByText } = render(
      <DockerSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    expect(getByText("app-1")).toBeDefined();
    expect(getByText("app-2")).toBeDefined();
  });

  it("filters out containers with missing required fields", () => {
    (trpc.terminal.listContainers.useQuery as Mock).mockReturnValue({
      data: [
        {
          id: "abc123",
          name: "valid-app",
          image: "nginx",
          status: "Up",
          state: "running",
        },
        {
          id: undefined,
          name: "missing-id",
          image: "nginx",
          status: "Up",
          state: "running",
        },
        {
          id: "def456",
          name: undefined,
          image: "nginx",
          status: "Up",
          state: "running",
        },
      ],
      isLoading: false,
      refetch: mockRefetch,
    });

    const { getByText, queryByText } = render(
      <DockerSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    expect(getByText("valid-app")).toBeDefined();
    expect(queryByText("missing-id")).toBeNull();
  });
});
