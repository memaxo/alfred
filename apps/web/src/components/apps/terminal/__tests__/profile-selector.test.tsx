import "@/test/dom";
import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "bun:test";

import { useTerminalProfiles } from "@/store/terminal";

vi.mock("@/utils/trpc", () => ({
  trpc: {
    terminal: {
      listContainers: {
        useQuery: vi.fn(() => ({
          data: [],
          isLoading: false,
          refetch: vi.fn(),
        })),
      },
    },
    useUtils: vi.fn(() => ({})),
  },
}));

import { ProfileSelector } from "../profile-selector";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("ProfileSelector", () => {
  const mockOnSelect = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnSelect.mockClear();
    mockOnClose.mockClear();
    useTerminalProfiles.setState({
      profiles: [
        {
          id: "local-default",
          name: "Local",
          type: "local",
          shell: "zsh",
          isDefault: true,
        },
        {
          id: "ssh-dev",
          name: "Dev Server",
          type: "ssh",
          host: "dev.example.com",
          port: 22,
        },
        {
          id: "docker-app",
          name: "Docker: app",
          type: "docker",
          container: "app-container",
        },
      ],
    });
  });

  it("renders all profiles", () => {
    const { getByText } = render(
      <ProfileSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    expect(getByText("Local")).toBeDefined();
    expect(getByText("Dev Server")).toBeDefined();
    expect(getByText("Docker: app")).toBeDefined();
  });

  it("displays profile details correctly", () => {
    const { getByText } = render(
      <ProfileSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    expect(getByText("zsh")).toBeDefined();
    expect(getByText("dev.example.com")).toBeDefined();
    expect(getByText("app-container")).toBeDefined();
  });

  it("calls onSelect when profile is clicked", () => {
    const { getByText } = render(
      <ProfileSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    const localProfile = getByText("Local").closest("button");
    if (localProfile) {
      fireEvent.click(localProfile);
    }

    expect(mockOnSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "local-default",
        name: "Local",
        type: "local",
      })
    );
  });

  it("calls onClose when close button is clicked", () => {
    const { getByTitle } = render(
      <ProfileSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(getByTitle("Close"));

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("shows default profile indicator", () => {
    const { container } = render(
      <ProfileSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    const starIcons = container.querySelectorAll("svg.fill-biolum");
    expect(starIcons.length).toBeGreaterThan(0);
  });

  it("displays SSH username and port in profile details", () => {
    useTerminalProfiles.setState({
      profiles: [
        {
          id: "ssh-full",
          name: "Full SSH",
          type: "ssh",
          host: "server.com",
          port: 2222,
          username: "admin",
          isDefault: true,
        },
      ],
    });

    const { getByText } = render(
      <ProfileSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    expect(getByText("admin@server.com:2222")).toBeDefined();
  });

  it("omits port 22 in SSH profile display", () => {
    useTerminalProfiles.setState({
      profiles: [
        {
          id: "ssh-default-port",
          name: "SSH Default Port",
          type: "ssh",
          host: "server.com",
          port: 22,
          isDefault: true,
        },
      ],
    });

    const { getByText, queryByText } = render(
      <ProfileSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    expect(getByText("server.com")).toBeDefined();
    expect(queryByText("server.com:22")).toBeNull();
  });

  it("shows New Profile button", () => {
    const { getByText } = render(
      <ProfileSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    expect(getByText("New Profile...")).toBeDefined();
  });

  it("shows Connect to Container button", () => {
    const { getByText } = render(
      <ProfileSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    expect(getByText("Connect to Container...")).toBeDefined();
  });

  it("toggles manage mode", () => {
    const { getByTitle, getByText } = render(
      <ProfileSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    const manageButton = getByTitle("Manage");
    fireEvent.click(manageButton);

    expect(getByText("Manage Profiles")).toBeDefined();
  });

  it("disables profile selection in manage mode", () => {
    const { getByTitle, getByText } = render(
      <ProfileSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    const manageButton = getByTitle("Manage");
    fireEvent.click(manageButton);

    const localProfile = getByText("Local").closest("button");
    if (localProfile) {
      fireEvent.click(localProfile);
    }

    expect(mockOnSelect).not.toHaveBeenCalled();
  });
});

describe("ProfileSelector - Profile Management", () => {
  const mockOnSelect = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnSelect.mockClear();
    mockOnClose.mockClear();
    useTerminalProfiles.setState({
      profiles: [
        {
          id: "local-default",
          name: "Local",
          type: "local",
          shell: "zsh",
          isDefault: true,
        },
        {
          id: "deletable",
          name: "Deletable Profile",
          type: "local",
          shell: "bash",
        },
      ],
    });
  });

  it("shows edit and delete buttons in manage mode", () => {
    const { getByTitle, getAllByTitle } = render(
      <ProfileSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(getByTitle("Manage"));

    const editButtons = getAllByTitle("Edit");
    expect(editButtons.length).toBeGreaterThan(0);
  });

  it("does not show delete button for default profile", () => {
    useTerminalProfiles.setState({
      profiles: [
        {
          id: "only-default",
          name: "Default Only",
          type: "local",
          shell: "zsh",
          isDefault: true,
        },
      ],
    });

    const { getByTitle, queryAllByTitle } = render(
      <ProfileSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(getByTitle("Manage"));

    const deleteButtons = queryAllByTitle("Delete");
    expect(deleteButtons.length).toBe(0);
  });

  it("shows set default button for non-default profiles", () => {
    const { getByTitle, getAllByTitle } = render(
      <ProfileSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(getByTitle("Manage"));

    const setDefaultButtons = getAllByTitle("Set as default");
    expect(setDefaultButtons.length).toBe(1);
  });

  it("deletes profile when delete button clicked", async () => {
    const { getByTitle, getAllByTitle } = render(
      <ProfileSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(getByTitle("Manage"));

    const deleteButton = getAllByTitle("Delete")[0];
    if (deleteButton) {
      fireEvent.click(deleteButton);
    }

    await waitFor(() => {
      const { profiles } = useTerminalProfiles.getState();
      expect(profiles.find((p) => p.id === "deletable")).toBeUndefined();
    });
  });

  it("sets profile as default when star button clicked", async () => {
    const { getByTitle, getAllByTitle } = render(
      <ProfileSelector onClose={mockOnClose} onSelect={mockOnSelect} />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(getByTitle("Manage"));

    const setDefaultButton = getAllByTitle("Set as default")[0];
    if (setDefaultButton) {
      fireEvent.click(setDefaultButton);
    }

    await waitFor(() => {
      const { profiles } = useTerminalProfiles.getState();
      const newDefault = profiles.find((p) => p.isDefault);
      expect(newDefault?.id).toBe("deletable");
    });
  });
});
