import "@/test/dom";
import {
  afterEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { authenticatedRender } from "@/test/auth";
import {
  createTestQueryClient,
  createTestTrpcClient,
} from "@/test/render-route";

const toastSuccess = vi.fn();
const toastError = vi.fn();

mock.module("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

const privacyRouteModule = await import("../_authed/privacy");
const PrivacyRouteComponent = privacyRouteModule.Route?.options
  ?.component as ComponentType | undefined;

if (!PrivacyRouteComponent) {
  throw new Error("Privacy route component is unavailable");
}

const factRecord = {
  id: "fact-1",
  userId: "user-1",
  content: "User prefers email updates.",
  category: "communication",
  source: "user",
  confidence: 0.72,
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
};

const eventRecord = {
  id: "event-1",
  type: "tool_use",
  timestamp: new Date().toISOString(),
  data: { tool: "note" },
  metadata: { duration: 120 },
};

describe("Privacy route", () => {
  afterEach(() => {
    cleanup();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("renders facts/events and deletes an entry", async () => {
    const queryClient = createTestQueryClient();
    const deleteSpy = vi.fn(async (input: unknown) => ({
      removed: 1,
      ...(input as Record<string, unknown>),
    }));
    const trpcClient = createTestTrpcClient({
      queries: {
        "privacy.facts": () => [factRecord],
        "privacy.events": () => [eventRecord],
      },
      mutations: {
        "privacy.deleteFact": deleteSpy,
      },
    });

    const { getAllByRole, getByText, queryByText } = authenticatedRender(
      <PrivacyRouteComponent />,
      { queryClient, trpcClient }
    );

    await waitFor(() => {
      expect(queryByText(/loading facts/i)).toBeNull();
      expect(queryByText(/loading events/i)).toBeNull();
    });

    expect(getByText(/user prefers email updates/i)).toBeTruthy();
    expect(getByText(/tool_use/i)).toBeTruthy();

    const factListItem = getByText(/user prefers email updates/i).closest("li");
    if (!factListItem) {
      throw new Error("Fact list item not found");
    }
    const factDeleteButton = factListItem.querySelector("button");
    if (!factDeleteButton) {
      throw new Error("Fact delete button not found");
    }
    fireEvent.click(factDeleteButton);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith({ id: "fact-1" });
    });
    expect(toastSuccess).toHaveBeenCalledWith("Fact deleted");
  });
});
