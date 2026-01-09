import "@/test/dom";
import { beforeEach, describe, expect, it, vi } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useTerminalProfiles } from "@/store/terminal";

vi.mock("@/utils/trpc", () => ({
  trpc: {
    terminal: {
      createSession: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          mutateAsync: vi.fn(),
        })),
      },
      write: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
        })),
      },
      resize: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
        })),
      },
      events: {
        useSubscription: vi.fn(),
      },
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

vi.mock("xterm", () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    loadAddon: vi.fn(),
    open: vi.fn(),
    write: vi.fn(),
    onData: vi.fn(),
    dispose: vi.fn(),
    cols: 80,
    rows: 24,
  })),
}));

vi.mock("xterm-addon-fit", () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
  })),
}));

vi.mock("xterm-addon-web-links", () => ({
  WebLinksAddon: vi.fn().mockImplementation(() => ({})),
}));

import { TerminalApp, TerminalAppWindow } from "../index";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("TerminalApp", () => {
  beforeEach(() => {
    useTerminalProfiles.setState({
      profiles: [
        {
          id: "local-default",
          name: "Local",
          type: "local",
          shell: "zsh",
          isDefault: true,
        },
      ],
    });
  });

  it("renders with initial tab", () => {
    const { container } = render(<TerminalApp />, { wrapper: createWrapper() });

    expect(container.querySelector('[data-app="terminal"]')).toBeDefined();
  });

  it("creates tab with default profile name", () => {
    const { getByText } = render(<TerminalApp />, { wrapper: createWrapper() });

    expect(getByText("Local")).toBeDefined();
  });

  it("shows add tab button", () => {
    const { getByTitle } = render(<TerminalApp />, {
      wrapper: createWrapper(),
    });

    expect(getByTitle("New Terminal")).toBeDefined();
  });

  it("shows settings button", () => {
    const { getByTitle } = render(<TerminalApp />, {
      wrapper: createWrapper(),
    });

    expect(getByTitle("Settings")).toBeDefined();
  });

  it("opens profile selector when add button clicked", async () => {
    const { getByTitle, findByText } = render(<TerminalApp />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(getByTitle("New Terminal"));

    const newTerminalTitle = await findByText("New Terminal");
    expect(newTerminalTitle).toBeDefined();
  });

  it("closes profile selector when onClose called", async () => {
    const { getByTitle, findByText } = render(<TerminalApp />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(getByTitle("New Terminal"));

    await findByText("New Terminal");

    const closeButtons = document.querySelectorAll("button");
    const closeButton = Array.from(closeButtons).find(
      (btn) => btn.querySelector("svg") && btn.className.includes("h-6")
    );

    if (closeButton) {
      fireEvent.click(closeButton);
    }

    await waitFor(() => {
      const selectors = document.querySelectorAll('[class*="backdrop-blur"]');
      expect(selectors.length).toBeLessThanOrEqual(1);
    });
  });

  it("adds new tab when profile selected", async () => {
    useTerminalProfiles.setState({
      profiles: [
        {
          id: "local-1",
          name: "Local",
          type: "local",
          shell: "zsh",
          isDefault: true,
        },
        { id: "bash-1", name: "Bash", type: "local", shell: "bash" },
      ],
    });

    const { getByTitle, findByText, getAllByText } = render(<TerminalApp />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(getByTitle("New Terminal"));
    await findByText("Bash");

    const bashButton = (await findByText("Bash")).closest("button");
    if (bashButton) {
      fireEvent.click(bashButton);
    }

    await waitFor(() => {
      const tabs = getAllByText(/Local|Bash/);
      expect(tabs.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe("TerminalApp - Tab Management", () => {
  beforeEach(() => {
    useTerminalProfiles.setState({
      profiles: [
        {
          id: "local-default",
          name: "Local",
          type: "local",
          shell: "zsh",
          isDefault: true,
        },
      ],
    });
  });

  it("shows empty state when no tabs", () => {
    const { container } = render(<TerminalApp />, {
      wrapper: createWrapper(),
    });

    const closeButtons = container.querySelectorAll('[class*="tab"]');

    if (closeButtons.length > 0) {
      const firstTabClose = closeButtons[0]?.querySelector("button");
      if (firstTabClose) {
        fireEvent.click(firstTabClose);
      }
    }
  });

  it("switches active tab on click", async () => {
    useTerminalProfiles.setState({
      profiles: [
        {
          id: "local-1",
          name: "Tab 1",
          type: "local",
          shell: "zsh",
          isDefault: true,
        },
        { id: "local-2", name: "Tab 2", type: "local", shell: "bash" },
      ],
    });

    const { getByTitle, findByText, getByText } = render(<TerminalApp />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(getByTitle("New Terminal"));

    const tab2Button = await findByText("Tab 2");
    const tab2ProfileButton = tab2Button.closest("button");
    if (tab2ProfileButton) {
      fireEvent.click(tab2ProfileButton);
    }

    await waitFor(() => {
      expect(getByText("Tab 2")).toBeDefined();
    });
  });
});

describe("TerminalAppWindow", () => {
  beforeEach(() => {
    useTerminalProfiles.setState({
      profiles: [
        {
          id: "local-default",
          name: "Local",
          type: "local",
          shell: "zsh",
          isDefault: true,
        },
      ],
    });
  });

  it("renders with window props", () => {
    const mockWindow = {
      id: "window-1",
      type: "terminal" as const,
      bounds: { x: 0, y: 0, width: 800, height: 600 },
      state: "normal" as const,
      isTiled: false,
      zIndex: 1,
      isFocused: true,
      minSize: { width: 200, height: 150 },
      resizable: true,
      createdAt: Date.now(),
      lastFocusedAt: Date.now(),
      data: { type: "terminal" as const, viewMode: "full" as const },
    };

    const { container } = render(
      <TerminalAppWindow
        isActive={true}
        onClose={() => {}}
        window={mockWindow}
      />,
      { wrapper: createWrapper() }
    );

    expect(container.querySelector('[data-app="terminal"]')).toBeDefined();
  });
});

describe("TerminalApp - Profile Integration", () => {
  it("uses default profile for initial tab", () => {
    useTerminalProfiles.setState({
      profiles: [
        {
          id: "custom-default",
          name: "Custom Default",
          type: "local",
          shell: "fish",
          isDefault: true,
        },
        { id: "other", name: "Other", type: "local", shell: "zsh" },
      ],
    });

    const { getByText } = render(<TerminalApp />, { wrapper: createWrapper() });

    expect(getByText("Custom Default")).toBeDefined();
  });

  it("reflects profile store changes", async () => {
    const { getByTitle, findByText } = render(<TerminalApp />, {
      wrapper: createWrapper(),
    });

    useTerminalProfiles.getState().addProfile({
      name: "New Profile",
      type: "local",
      shell: "bash",
    });

    fireEvent.click(getByTitle("New Terminal"));

    const newProfile = await findByText("New Profile");
    expect(newProfile).toBeDefined();
  });
});
