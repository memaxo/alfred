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
import {
  authenticatedRender,
  setTestPasskeys,
} from "@/test/auth";
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

const profileRouteModule = await import("../_authed/profile");
const ProfileRouteComponent = profileRouteModule.Route?.options
  ?.component as ComponentType | undefined;

if (!ProfileRouteComponent) {
  throw new Error("Profile route component is unavailable");
}

const baseProfile = {
  id: "profile-1",
  userId: "user-1",
  name: "Alfred Pennyworth",
  email: "alfred@example.com",
  avatar: null,
  timezone: "America/New_York",
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
};

describe("Profile route", () => {
  afterEach(() => {
    cleanup();
    setTestPasskeys([]);
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("updates profile with trimmed input and emits a success toast", async () => {
    const queryClient = createTestQueryClient();
    const updateSpy = vi.fn(async (input: unknown) => ({
      ...baseProfile,
      ...(input as Record<string, unknown>),
    }));
    const trpcClient = createTestTrpcClient({
      queries: {
        "profile.get": () => baseProfile,
      },
      mutations: {
        "profile.update": updateSpy,
      },
    });

    const { getByPlaceholderText, getByRole } = authenticatedRender(
      <ProfileRouteComponent />,
      { queryClient, trpcClient }
    );
    const user = userEvent.setup();

    const nameInput = getByPlaceholderText("Name") as HTMLInputElement;
    const emailInput = getByPlaceholderText("Email") as HTMLInputElement;
    const avatarInput = getByPlaceholderText(
      "Avatar URL"
    ) as HTMLInputElement;
    const timezoneInput = getByPlaceholderText(
      "Timezone (e.g. America/New_York)"
    ) as HTMLInputElement;

    await waitFor(() => {
      expect(nameInput.value).toBe("Alfred Pennyworth");
    });

    await user.click(nameInput);
    await user.keyboard("{Control>}a{/Control}{Backspace}  Bruce Wayne  ");
    await user.click(emailInput);
    await user.keyboard(
      "{Control>}a{/Control}{Backspace}  bruce@wayneenterprises.com "
    );
    await user.click(avatarInput);
    await user.keyboard(
      "{Control>}a{/Control}{Backspace} https://example.com/avatar.png  "
    );
    await user.click(timezoneInput);
    await user.keyboard(
      "{Control>}a{/Control}{Backspace} America/New_York "
    );

    fireEvent.click(getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        name: "Bruce Wayne",
        email: "bruce@wayneenterprises.com",
        avatar: "https://example.com/avatar.png",
        timezone: "America/New_York",
      });
    });

    expect(toastSuccess).toHaveBeenCalledWith("Profile updated");
  });
});
