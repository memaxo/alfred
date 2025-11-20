import "@/test/dom";
import { afterEach, describe, expect, it, vi } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import {
  createTestQueryClient,
  createTestTrpcClient,
  renderRoute,
} from "@/test/render-route";

afterEach(() => {
  cleanup();
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
      expect(getByLabelText(/duration/i)).toBeInTheDocument();
      expect(getByLabelText(/label/i)).toBeInTheDocument();
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
      expect(getByLabelText(/duration/i)).toBeInTheDocument();
    });

    const durationInput = getByLabelText(/duration/i);
    const labelInput = getByLabelText(/label/i);
    const submitButton = getByRole("button", { name: /create/i });

    await userEvent.type(durationInput, "30m");
    await userEvent.type(labelInput, "Test Timer");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: "30m",
          label: "Test Timer",
        })
      );
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
      expect(getByLabelText(/url/i)).toBeInTheDocument();
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
      expect(getByLabelText(/url/i)).toBeInTheDocument();
    });

    const urlInput = getByLabelText(/url/i);
    const submitButton = getByRole("button", { name: /create/i });

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
        "workflow.list": () => ({
          items: [],
          total: 0,
          hasMore: false,
        }),
      },
    });

    const { getByText } = renderRoute(<WorkflowsRouteComponent />, {
      queryClient,
      trpcClient,
    });

    await waitFor(() => {
      expect(getByText(/workflows/i)).toBeInTheDocument();
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
        "workflow.list": () => ({
          items: [],
          total: 0,
          hasMore: false,
        }),
      },
    });

    const { getByText } = renderRoute(<WorkflowsRouteComponent />, {
      queryClient,
      trpcClient,
    });

    await waitFor(() => {
      // Check for empty state or table headers
      const emptyState = getByText(/no workflows/i);
      expect(emptyState).toBeInTheDocument();
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
      expect(getByText(/welcome/i)).toBeInTheDocument();
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
      expect(getByText(/welcome/i)).toBeInTheDocument();
    });

    const nextButton = getByRole("button", { name: /next/i });
    fireEvent.click(nextButton);

    await waitFor(() => {
      // Should move to next step
      expect(getByText(/preferences/i)).toBeInTheDocument();
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
      expect(getByText(/welcome/i)).toBeInTheDocument();
    });

    const nextButton = getByRole("button", { name: /next/i });
    
    // Click through all steps
    for (let i = 0; i < 3; i++) {
      fireEvent.click(nextButton);
      await waitFor(() => {
        expect(nextButton).toBeInTheDocument();
      });
    }

    // Complete onboarding
    const completeButton = getByRole("button", { name: /complete/i });
    fireEvent.click(completeButton);

    await waitFor(() => {
      expect(setPreferenceSpy).toHaveBeenCalled();
    });
  });
});
