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
import userEvent from "@testing-library/user-event";
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

const preferencesRouteModule = await import("../_authed/preferences");
const PreferencesRouteComponent = preferencesRouteModule.Route?.options
  ?.component as ComponentType | undefined;

if (!PreferencesRouteComponent) {
  throw new Error("Preferences route component is unavailable");
}

const preferenceRecord = {
  id: "pref-1",
  userId: "user-1",
  key: "theme",
  value: { mode: "dark" },
  confidence: 0.9,
  source: "user",
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
};

describe("Preferences route", () => {
  afterEach(() => {
    cleanup();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("submits JSON preference values and resets the form", async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    const setSpy = vi.fn(async (input: unknown) => ({
      ...preferenceRecord,
      id: "pref-new",
      ...(input as Record<string, unknown>),
    }));
    const trpcClient = createTestTrpcClient({
      queries: {
        "preference.list": () => [preferenceRecord],
      },
      mutations: {
        "preference.set": setSpy,
        "preference.delete": vi.fn(async () => ({ removed: 1 })),
      },
    });

    const { getByPlaceholderText, getByRole } = authenticatedRender(
      <PreferencesRouteComponent />,
      { queryClient, trpcClient }
    );

    const keyInput = getByPlaceholderText(
      "Preference key"
    ) as HTMLInputElement;
    const valueInput = getByPlaceholderText(
      'JSON value, e.g. {"mode":"dark"}'
    ) as HTMLTextAreaElement;
    const confidenceInput = getByPlaceholderText(
      "Confidence (0-1)"
    ) as HTMLInputElement;

    await user.type(keyInput, "notifications");
    await user.type(valueInput, "enabled");
    await user.clear(confidenceInput);
    await user.type(confidenceInput, "0.85");

    await waitFor(() => {
      expect(keyInput.value).toBe("notifications");
      expect(valueInput.value).toBe("enabled");
      expect(confidenceInput.value).toBe("0.85");
    });

    fireEvent.click(getByRole("button", { name: /save preference/i }));

    await waitFor(() => {
      expect(setSpy).toHaveBeenCalledWith({
        key: "notifications",
        value: "enabled",
        confidence: 0.85,
      });
    });

    expect(toastSuccess).toHaveBeenCalledWith("Preference saved");
    expect(keyInput.value).toBe("");
    expect(valueInput.value).toBe("");
    expect(confidenceInput.value).toBe("1");
  });

  it("deletes a preference entry", async () => {
    const queryClient = createTestQueryClient();
    const deleteSpy = vi.fn(async () => ({ removed: 1 }));
    const trpcClient = createTestTrpcClient({
      queries: {
        "preference.list": () => [preferenceRecord],
      },
      mutations: {
        "preference.set": vi.fn(async () => preferenceRecord),
        "preference.delete": deleteSpy,
      },
    });

    const { getAllByRole } = authenticatedRender(
      <PreferencesRouteComponent />,
      { queryClient, trpcClient }
    );

    await waitFor(() => {
      const buttons = getAllByRole("button", { name: /delete/i });
      expect(buttons.length).toBeGreaterThan(0);
    });

    const deleteButton = getAllByRole("button", { name: /delete/i })[0];
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith({ key: "theme" });
    });
    expect(toastSuccess).toHaveBeenCalledWith("Preference removed");
  });
});
