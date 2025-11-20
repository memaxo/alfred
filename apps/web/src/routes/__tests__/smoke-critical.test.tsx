import "@/test/dom";
import type { ReactNode } from "react";
import {
  afterEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import { cleanup, waitFor } from "@testing-library/react";
import { renderRoute, createTestTrpcClient } from "@/test/render-route";

mock.module("react-virtuoso", () => ({
  Virtuoso: ({
    data,
    itemContent,
  }: {
    data: unknown[];
    itemContent: (index: number, value: unknown) => ReactNode;
  }) => (
    <div data-testid="virtuoso-stub">
      {data.map((value, index) => (
        <div key={`item-${index}`}>{itemContent(index, value)}</div>
      ))}
    </div>
  ),
}));

mock.module("@/hooks/use-assistant-stream", () => ({
  useAssistantStream: () => ({
    messages: [],
    actions: [],
    status: "ready",
    error: null,
    send: vi.fn(),
    clear: vi.fn(),
    hydrate: vi.fn(),
  }),
}));

mock.module("@/hooks/use-voice-capture", () => ({
  useVoiceCapture: () => ({
    isRecording: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    error: null,
  }),
}));

mock.module("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ isPending: false }),
    signUp: {
      email: vi.fn((_input, callbacks) => callbacks?.onSuccess?.()),
    },
    signIn: {
      email: vi.fn((_input, callbacks) => callbacks?.onSuccess?.()),
    },
  },
}));

const tanstackRouterModule = await import("@tanstack/react-router");

mock.module("@tanstack/react-router", () => ({
  ...tanstackRouterModule,
  useNavigate: () => () => {},
}));

afterEach(() => {
  cleanup();
});

async function loadRouteComponent(modulePath: string) {
  const routeModule = await import(modulePath);
  const component = routeModule.Route?.options?.component;
  if (!component) {
    throw new Error(`Route at ${modulePath} is missing a component`);
  }
  return component;
}

describe("Smoke: Critical routes", () => {
  it("renders the login route by defaulting to sign up form", async () => {
    const Component = await loadRouteComponent("../login");
    const trpcClient = createTestTrpcClient();
    const view = renderRoute(<Component />, { trpcClient });

    await waitFor(() => {
      expect(view.getByText(/create account/i)).toBeTruthy();
    });
  });

  it("renders the AI route chat container", async () => {
    const Component = await loadRouteComponent("../ai");
    const trpcClient = createTestTrpcClient();
    const view = renderRoute(<Component />, { trpcClient });

    await waitFor(() => {
      expect(view.getByPlaceholderText(/ask alfred/i)).toBeTruthy();
    });
  });

  it("renders the notes route with existing notes", async () => {
    const Component = await loadRouteComponent("../note");
    const noteList = [
      {
        id: "note-1",
        title: "Smoke note",
        content: "Ensure coverage exists",
        createdAt: new Date("2025-01-01T00:00:00Z"),
      },
    ];
    const trpcClient = createTestTrpcClient({
      queries: {
        "note.list": () => noteList,
      },
    });

    const view = renderRoute(<Component />, { trpcClient });

    await waitFor(() => {
      expect(view.getAllByText(/notes/i).length).toBeGreaterThan(0);
      expect(view.getByText(/smoke note/i)).toBeTruthy();
    });
  });

  it("renders the reminders route with due and upcoming data", async () => {
    const Component = await loadRouteComponent("../remind");
    const reminders = [
      {
        id: "remind-1",
        title: "Prepare demo",
        due: new Date("2025-01-01T12:00:00Z").toISOString(),
        description: "Walk through smoke tests",
      },
    ];
    const dueSoon = [
      {
        id: "due-1",
        title: "Sync with Alfred",
        due: new Date("2025-01-01T10:00:00Z").toISOString(),
        description: null,
      },
    ];
    const trpcClient = createTestTrpcClient({
      queries: {
        "remind.list": () => reminders,
        "remind.due": () => dueSoon,
      },
    });

    const view = renderRoute(<Component />, { trpcClient });

    await waitFor(() => {
      expect(view.getAllByText(/reminders/i).length).toBeGreaterThan(0);
      expect(view.getByText(/prepare demo/i)).toBeTruthy();
      expect(view.getByText(/sync with alfred/i)).toBeTruthy();
    });
  });

  it("renders the profile route with user data", async () => {
    const Component = await loadRouteComponent("../profile");
    const profileRow = {
      id: "profile-1",
      userId: "user-1",
      name: "Alfred Pennyworth",
      email: "alfred@batcave.dev",
      avatar: "https://example.com/alfred.png",
      timezone: "America/New_York",
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };
    const trpcClient = createTestTrpcClient({
      queries: {
        "profile.get": () => profileRow,
      },
    });

    const view = renderRoute(<Component />, { trpcClient });

    await waitFor(() => {
      expect(view.getAllByText(/profile/i).length).toBeGreaterThan(0);
      expect(view.getByDisplayValue(/alfred@batcave\.dev/i)).toBeTruthy();
    });
  });
});
