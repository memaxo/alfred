import "../../test/reset-mocks";
import { describe, expect, it } from "bun:test";
import { Route as TimerRoute } from "@/routes/_protected/timer";
import {
  createTestQueryClient,
  createTestTrpcClient,
  renderRoute,
  type TestTrpcHandlers,
} from "@/test/render-route";
import { fireEvent, waitFor } from "../../test/testing-library";

describe("TimerRoute", () => {
  const TimerView = TimerRoute.options
    .component as unknown as () => JSX.Element;

  describe("TimerCreateForm", () => {
    it("renders duration and label inputs", () => {
      const handlers: TestTrpcHandlers = {
        queries: {
          "timer.active": () => [],
        },
      };

      const view = renderRoute(<TimerView />, {
        queryClient: createTestQueryClient(),
        trpcClient: createTestTrpcClient(handlers),
      });

      expect(view.getByLabelText(/duration/i)).toBeTruthy();
      expect(view.getByLabelText(/label/i)).toBeTruthy();
      expect(view.getByRole("button", { name: /start timer/i })).toBeTruthy();
      view.unmount();
    });

    it("creates timer with default duration", async () => {
      let createInput: { duration?: number; label?: string } | null = null;
      const handlers: TestTrpcHandlers = {
        queries: {
          "timer.active": () => [],
        },
        mutations: {
          "timer.create": (input) => {
            createInput = input as { duration?: number; label?: string };
            return {
              id: "timer-1",
              duration: createInput?.duration ?? 0,
              label: createInput?.label ?? null,
              start: new Date(),
            };
          },
        },
      };

      const view = renderRoute(<TimerView />, {
        queryClient: createTestQueryClient(),
        trpcClient: createTestTrpcClient(handlers),
      });

      // Click submit with the default value of 25 minutes
      const submitButton = view.getByRole("button", { name: /start timer/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(createInput).not.toBeNull();
        // Default duration is 25 minutes = 1500 seconds
        expect(createInput?.duration).toBe(1500);
      });
      view.unmount();
    });
  });

  describe("TimerPane", () => {
    it("renders empty state when no active timers", async () => {
      const handlers: TestTrpcHandlers = {
        queries: {
          "timer.active": () => [],
        },
      };

      const view = renderRoute(<TimerView />, {
        queryClient: createTestQueryClient(),
        trpcClient: createTestTrpcClient(handlers),
      });

      await waitFor(() => {
        expect(view.getByText(/no active timers/i)).toBeTruthy();
      });
      view.unmount();
    });

    it("renders active timers with countdown", async () => {
      const now = new Date();
      const handlers: TestTrpcHandlers = {
        queries: {
          "timer.active": () => [
            {
              id: "timer-1",
              label: "Work session",
              duration: 1500, // 25 minutes
              start: now,
              completed: false,
              cancelled: false,
            },
          ],
        },
      };

      const view = renderRoute(<TimerView />, {
        queryClient: createTestQueryClient(),
        trpcClient: createTestTrpcClient(handlers),
      });

      await waitFor(() => {
        expect(view.getByText("Work session")).toBeTruthy();
      });
      view.unmount();
    });

    it("completes timer on Done click", async () => {
      let completedId: string | null = null;
      const now = new Date();
      const handlers: TestTrpcHandlers = {
        queries: {
          "timer.active": () => [
            {
              id: "timer-1",
              label: "Focus",
              duration: 300,
              start: now,
              completed: false,
              cancelled: false,
            },
          ],
        },
        mutations: {
          "timer.done": (input) => {
            completedId = (input as { id: string }).id;
            return { updated: true };
          },
        },
      };

      const view = renderRoute(<TimerView />, {
        queryClient: createTestQueryClient(),
        trpcClient: createTestTrpcClient(handlers),
      });

      await waitFor(() => {
        expect(view.getByText("Focus")).toBeTruthy();
      });

      const doneButton = view.getByRole("button", { name: /done/i });
      fireEvent.click(doneButton);

      await waitFor(() => {
        expect(completedId).toBe("timer-1");
      });
      view.unmount();
    });

    it("cancels timer on Cancel click", async () => {
      let cancelledId: string | null = null;
      const now = new Date();
      const handlers: TestTrpcHandlers = {
        queries: {
          "timer.active": () => [
            {
              id: "timer-2",
              label: "Break",
              duration: 600,
              start: now,
              completed: false,
              cancelled: false,
            },
          ],
        },
        mutations: {
          "timer.cancel": (input) => {
            cancelledId = (input as { id: string }).id;
            return { updated: true };
          },
        },
      };

      const view = renderRoute(<TimerView />, {
        queryClient: createTestQueryClient(),
        trpcClient: createTestTrpcClient(handlers),
      });

      await waitFor(() => {
        expect(view.getByText("Break")).toBeTruthy();
      });

      const cancelButton = view.getByRole("button", { name: /cancel/i });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(cancelledId).toBe("timer-2");
      });
      view.unmount();
    });

    it("shows expired timers with Complete! label", async () => {
      // Start time 30 minutes ago, duration 25 minutes = expired
      const startTime = new Date(Date.now() - 30 * 60 * 1000);
      const handlers: TestTrpcHandlers = {
        queries: {
          "timer.active": () => [
            {
              id: "timer-expired",
              label: "Pomodoro",
              duration: 1500, // 25 minutes
              start: startTime,
              completed: false,
              cancelled: false,
            },
          ],
        },
      };

      const view = renderRoute(<TimerView />, {
        queryClient: createTestQueryClient(),
        trpcClient: createTestTrpcClient(handlers),
      });

      await waitFor(() => {
        expect(view.getByText("Pomodoro")).toBeTruthy();
        expect(view.getByText("Complete!")).toBeTruthy();
      });
      view.unmount();
    });
  });
});
