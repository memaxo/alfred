import "@/test/dom";
import "@/test/mock-assistant-chat";
import {
  afterEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType, ReactNode } from "react";
import {
  authenticatedRender,
  setTestPasskeys,
} from "@/test/auth";
import {
  createTestQueryClient,
  createTestTrpcClient,
  renderRoute,
} from "@/test/render-route";

mock.module("react-virtuoso", () => ({
  Virtuoso: ({
    data,
    itemContent,
  }: {
    data: unknown[];
    itemContent: (index: number, message: unknown) => ReactNode;
  }) => (
    <div data-testid="stub-virtuoso">
      {data.map((message, index) => (
        <div key={`message-${index}`}>
          {itemContent(index, message)}
        </div>
      ))}
    </div>
  ),
}));

mock.module("@/hooks/use-voice-capture", () => ({
  useVoiceCapture: () => ({
    isRecording: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    error: null,
  }),
}));

mock.module("@/components/tremor", () => ({
  BiolumBadge: ({ children }: { children?: ReactNode }) => (
    <span data-testid="biolum-badge">{children}</span>
  ),
}));

async function getRouteComponent(
  modulePath: string
): Promise<ComponentType> {
  const routeModule = await import(modulePath);
  const component = routeModule.Route?.options
    ?.component as ComponentType | undefined;
  if (!component) {
    throw new Error(`Route component is unavailable: ${modulePath}`);
  }
  return component;
}

afterEach(() => {
  cleanup();
});

describe("Login Route Smoke Tests", () => {
  it("renders sign up by default and toggles to sign in", async () => {
    const LoginRouteComponent = await getRouteComponent("../../routes/login");
    const { getByRole } = renderRoute(<LoginRouteComponent />);

    await waitFor(() => {
      expect(
        getByRole("heading", { name: /create account/i })
      ).toBeTruthy();
    });

    const switchButton = getByRole("button", {
      name: /already have an account/i,
    });
    await userEvent.click(switchButton);

    await waitFor(() => {
      expect(
        getByRole("heading", { name: /welcome back/i })
      ).toBeTruthy();
    });
  });
});

describe("AI Route Smoke Tests", () => {
  it("renders chat controls for the assistant agent", async () => {
    const AiRouteComponent = await getRouteComponent("../../routes/_authed/ai");
    const { getByRole } = authenticatedRender(<AiRouteComponent />);

    await waitFor(() => {
      expect(
        getByRole("tab", { name: /^assistant$/i })
      ).toBeTruthy();
      expect(
        getByRole("tab", { name: /orchestrator/i })
      ).toBeTruthy();
    });
  });
});

describe("Note Route Smoke Tests", () => {
  it("renders existing notes and exposes the editor form", async () => {
    const NoteRouteComponent = await getRouteComponent(
      "../../routes/_authed/note"
    );
    const queryClient = createTestQueryClient();
    const trpcClient = createTestTrpcClient({
      queries: {
        "note.list": () => [
          {
            id: "note-smoke",
            title: "Smoke Note",
            content: "Rendered from the smoke suite",
            createdAt: new Date("2025-01-01T00:00:00Z"),
          },
        ],
      },
    });

    const { getByPlaceholderText, getByText } = authenticatedRender(
      <NoteRouteComponent />,
      { queryClient, trpcClient }
    );

    await waitFor(() => {
      expect(getByText(/smoke note/i)).toBeTruthy();
      expect(
        getByPlaceholderText(/write your note/i)
      ).toBeTruthy();
    });
  });
});

describe("Remind Route Smoke Tests", () => {
  it("renders reminders and due soon section", async () => {
    const RemindRouteComponent = await getRouteComponent(
      "../../routes/_authed/remind"
    );
    const now = new Date("2025-03-05T12:00:00Z").toISOString();
    const queryClient = createTestQueryClient();
    const trpcClient = createTestTrpcClient({
      queries: {
        "remind.list": () => [
          {
            id: "remind-1",
            title: "Demo reminder",
            due: now,
            description: "Smoke coverage item",
          },
        ],
        "remind.due": () => [
          {
            id: "due-1",
            title: "Due reminder",
            due: now,
            description: null,
          },
        ],
      },
    });

    const { getByText } = authenticatedRender(<RemindRouteComponent />, {
      queryClient,
      trpcClient,
    });

    await waitFor(() => {
      expect(getByText(/demo reminder/i)).toBeTruthy();
      expect(getByText(/due now/i)).toBeTruthy();
    });
  });
});

describe("Profile Route Smoke Tests", () => {
  afterEach(() => {
    setTestPasskeys([]);
  });

  it("renders profile form fields and passkey list", async () => {
    const ProfileRouteComponent = await getRouteComponent(
      "../../routes/_authed/profile"
    );
    setTestPasskeys([
      {
        id: "pk-1",
        name: "Studio Display",
        deviceType: "hardware-key",
        createdAt: "2025-02-01T00:00:00Z",
      },
    ]);

    const baseProfile = {
      id: "profile-1",
      userId: "test-user",
      name: "Alfred Pennyworth",
      email: "alfred@example.com",
      avatar: null,
      timezone: "America/New_York",
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };

    const queryClient = createTestQueryClient();
    const trpcClient = createTestTrpcClient({
      queries: {
        "profile.get": () => baseProfile,
      },
      mutations: {
        "profile.update": async (input: unknown) => ({
          ...baseProfile,
          ...(input as Record<string, unknown>),
        }),
      },
    });

    const { getByPlaceholderText, getByText } = authenticatedRender(
      <ProfileRouteComponent />,
      { queryClient, trpcClient }
    );

    await waitFor(() => {
      expect(getByPlaceholderText("Name")).toBeTruthy();
      expect(getByText(/security & passkeys/i)).toBeTruthy();
      expect(getByText(/studio display/i)).toBeTruthy();
    });
  });
});

describe("Timer Route Smoke Tests", () => {
  it("renders timer route component", async () => {
    const timerRouteModule = await import("../../routes/_authed/timer");
    const TimerRouteComponent = timerRouteModule.Route?.options
      ?.component as ComponentType | undefined;

    if (!TimerRouteComponent) {
      throw new Error("Timer route component is unavailable");
    }

    const queryClient = createTestQueryClient();
    const trpcClient = createTestTrpcClient({
      queries: {
        "timer.active": () => [],
      },
      mutations: {
        "timer.create": vi.fn((input: unknown) => ({
          id: "timer-1",
          ...(input as Record<string, unknown>),
        })),
      },
    });

    const { getByLabelText, getByRole } = renderRoute(
      <TimerRouteComponent />,
      { queryClient, trpcClient }
    );

    await waitFor(() => {
      expect(getByLabelText(/duration/i)).toBeTruthy();
      expect(getByLabelText(/label/i)).toBeTruthy();
    });
  });

  it("handles timer creation mutation", async () => {
    const timerRouteModule = await import("../../routes/_authed/timer");
    const TimerRouteComponent = timerRouteModule.Route?.options
      ?.component as ComponentType | undefined;

    if (!TimerRouteComponent) {
      throw new Error("Timer route component is unavailable");
    }

    const createSpy = vi.fn((input: unknown) => ({
      id: "timer-1",
      ...(input as Record<string, unknown>),
    }));

    const queryClient = createTestQueryClient();
    const trpcClient = createTestTrpcClient({
      queries: {
        "timer.active": () => [],
      },
      mutations: {
        "timer.create": createSpy,
      },
    });

    const { getByLabelText, getByRole } = renderRoute(
      <TimerRouteComponent />,
      { queryClient, trpcClient }
    );

    await waitFor(() => {
      expect(getByLabelText(/duration/i)).toBeTruthy();
    });

    const durationInput = getByLabelText(/duration/i);
    const labelInput = getByLabelText(/label/i);
    const submitButton = getByRole("button", { name: /start timer/i });

    await userEvent.type(durationInput, "30");
    await userEvent.type(labelInput, "Test Timer");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        duration: 1800,
        label: "Test Timer",
      });
    });
  });
});

describe("Bookmark Route Smoke Tests", () => {
  it("renders bookmark route component", async () => {
    const bookRouteModule = await import("../../routes/_authed/book");
    const BookRouteComponent = bookRouteModule.Route?.options
      ?.component as ComponentType | undefined;

    if (!BookRouteComponent) {
      throw new Error("Book route component is unavailable");
    }

    const queryClient = createTestQueryClient();
    const trpcClient = createTestTrpcClient({
      queries: {
        "book.list": () => [],
      },
      mutations: {
        "book.create": vi.fn((input: unknown) => ({
          id: "book-1",
          ...(input as Record<string, unknown>),
        })),
      },
    });

    const { getByLabelText } = renderRoute(<BookRouteComponent />, {
      queryClient,
      trpcClient,
    });

    await waitFor(() => {
      expect(getByLabelText(/url/i)).toBeTruthy();
    });
  });

  it("validates URL input", async () => {
    const bookRouteModule = await import("../../routes/_authed/book");
    const BookRouteComponent = bookRouteModule.Route?.options
      ?.component as ComponentType | undefined;

    if (!BookRouteComponent) {
      throw new Error("Book route component is unavailable");
    }

    const createSpy = vi.fn();

    const queryClient = createTestQueryClient();
    const trpcClient = createTestTrpcClient({
      queries: {
        "book.list": () => [],
      },
      mutations: {
        "book.create": createSpy,
      },
    });

    const { getByLabelText, getByRole } = renderRoute(<BookRouteComponent />, {
      queryClient,
      trpcClient,
    });

    await waitFor(() => {
      expect(getByLabelText(/url/i)).toBeTruthy();
    });

    const urlInput = getByLabelText(/url/i);
    const submitButton = getByRole("button", { name: /add bookmark/i });

    // Try submitting with empty URL
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(createSpy).not.toHaveBeenCalled();
    });

    // Submit with valid URL
    await userEvent.type(urlInput, "https://example.com");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com",
        })
      );
    });
  });
});

describe("Workflows Route Smoke Tests", () => {
  it("renders workflows route component", async () => {
    const workflowsRouteModule = await import("../../routes/_authed/workflows");
    const WorkflowsRouteComponent = workflowsRouteModule.Route?.options
      ?.component as ComponentType | undefined;

    if (!WorkflowsRouteComponent) {
      throw new Error("Workflows route component is unavailable");
    }

    const queryClient = createTestQueryClient();
    const trpcClient = createTestTrpcClient({
      queries: {
        "workflow.listRuns": () => [
          {
            id: "wf-1",
            workflowId: "demo-workflow",
            status: "running",
            startedAt: new Date("2025-01-01T00:00:00Z"),
            completedAt: null,
            cancelledAt: null,
            userId: "test-user",
            created: new Date("2025-01-01T00:00:00Z"),
            updated: new Date("2025-01-01T00:00:00Z"),
          },
        ],
      },
    });

    const { getByText } = renderRoute(<WorkflowsRouteComponent />, {
      queryClient,
      trpcClient,
    });

    await waitFor(() => {
      expect(getByText(/workflows/i)).toBeTruthy();
    });
  });

  it("displays empty state when no workflows", async () => {
    const workflowsRouteModule = await import("../../routes/_authed/workflows");
    const WorkflowsRouteComponent = workflowsRouteModule.Route?.options
      ?.component as ComponentType | undefined;

    if (!WorkflowsRouteComponent) {
      throw new Error("Workflows route component is unavailable");
    }

    const queryClient = createTestQueryClient();
    const trpcClient = createTestTrpcClient({
      queries: {
        "workflow.listRuns": () => [],
      },
    });

    const { getByText } = renderRoute(<WorkflowsRouteComponent />, {
      queryClient,
      trpcClient,
    });

    await waitFor(() => {
      // Check for empty state or table headers
      const emptyState = getByText(/no workflows/i);
      expect(emptyState).toBeTruthy();
    });
  });
});

describe("Onboarding Route Smoke Tests", () => {
  it("renders onboarding wizard component", async () => {
    const onboardingRouteModule = await import("../../routes/onboarding");
    const OnboardingRouteComponent = onboardingRouteModule.Route?.options
      ?.component as ComponentType | undefined;

    if (!OnboardingRouteComponent) {
      throw new Error("Onboarding route component is unavailable");
    }

    const queryClient = createTestQueryClient();
    const trpcClient = createTestTrpcClient({
      mutations: {
        "preference.set": vi.fn(() => ({ ok: true })),
      },
    });

    const { getByText } = renderRoute(<OnboardingRouteComponent />, {
      queryClient,
      trpcClient,
    });

    await waitFor(() => {
      // First step should be visible
      expect(getByText(/welcome/i)).toBeTruthy();
    });
  });

  it("navigates through wizard steps", async () => {
    const onboardingRouteModule = await import("../../routes/onboarding");
    const OnboardingRouteComponent = onboardingRouteModule.Route?.options
      ?.component as ComponentType | undefined;

    if (!OnboardingRouteComponent) {
      throw new Error("Onboarding route component is unavailable");
    }

    const queryClient = createTestQueryClient();
    const trpcClient = createTestTrpcClient({
      mutations: {
        "preference.set": vi.fn(() => ({ ok: true })),
      },
    });

    const { getByRole, getByText } = renderRoute(<OnboardingRouteComponent />, {
      queryClient,
      trpcClient,
    });

    await waitFor(() => {
      expect(getByText(/welcome/i)).toBeTruthy();
    });

    const nextButton = getByRole("button", { name: /next/i });
    fireEvent.click(nextButton);

    await waitFor(() => {
      // Should move to next step
      expect(getByText(/preferences/i)).toBeTruthy();
    });
  });

  it("handles completion flow", async () => {
    const onboardingRouteModule = await import("../../routes/onboarding");
    const OnboardingRouteComponent = onboardingRouteModule.Route?.options
      ?.component as ComponentType | undefined;

    if (!OnboardingRouteComponent) {
      throw new Error("Onboarding route component is unavailable");
    }

    const setPreferenceSpy = vi.fn(() => ({ ok: true }));

    const queryClient = createTestQueryClient();
    const trpcClient = createTestTrpcClient({
      mutations: {
        "preference.set": setPreferenceSpy,
      },
    });

    const { getByRole, getByText } = renderRoute(<OnboardingRouteComponent />, {
      queryClient,
      trpcClient,
    });

    // Navigate to last step
    await waitFor(() => {
      expect(getByText(/welcome/i)).toBeTruthy();
    });

    const nextButton = getByRole("button", { name: /next/i });
    
    // Click through all steps
    for (let i = 0; i < 3; i++) {
      fireEvent.click(nextButton);
      await waitFor(() => {
        expect(nextButton).toBeTruthy();
      });
    }

    // Complete onboarding
    const completeButton = getByRole("button", { name: /get started/i });
    fireEvent.click(completeButton);

    await waitFor(() => {
      expect(setPreferenceSpy).toHaveBeenCalled();
    });
  });
});
