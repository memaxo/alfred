import "@/test/dom";
import { beforeAll, beforeEach, describe, expect, it, mock, vi } from "bun:test";
import type { ProfileUpdateInput } from "@alfred/type";

const toastSuccess = vi.fn();
const toastError = vi.fn();

mock.module("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

let render: typeof import("@testing-library/react").render;
let fireEvent: typeof import("@testing-library/react")["fireEvent"];
let screen: typeof import("@testing-library/react").screen;
let waitFor: typeof import("@testing-library/react").waitFor;

beforeAll(async () => {
  const rtl = await import("@testing-library/react");
  render = rtl.render;
  fireEvent = rtl.fireEvent;
  screen = rtl.screen;
  waitFor = rtl.waitFor;
});

const setData = vi.fn();
const cancel = vi.fn().mockResolvedValue(undefined);
const invalidate = vi.fn().mockResolvedValue(undefined);
const getData = vi.fn();

const updatedProfile = {
  id: "profile-1",
  userId: "user-1",
  name: "Bruce Wayne",
  email: "bruce@wayneenterprises.com",
  avatar: "https://example.com/avatar.png",
  timezone: "America/New_York",
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
};

let profileQueryResult: {
  data: typeof updatedProfile | null;
  isLoading: boolean;
  isFetching: boolean;
};

const mutateSpy = vi.fn();

const trpcMock = {
  useUtils: () => ({
    profile: {
      get: {
        cancel,
        getData,
        setData,
        invalidate,
      },
    },
  }),
  profile: {
    get: {
      useQuery: () => profileQueryResult,
    },
    update: {
      useMutation: (config?: {
        onMutate?: (input: ProfileUpdateInput) => unknown | Promise<unknown>;
        onSuccess?: (
          data: typeof updatedProfile,
          input: ProfileUpdateInput,
          context: unknown,
        ) => void | Promise<void>;
        onSettled?: (
          data: typeof updatedProfile | undefined,
          error: Error | null,
          input: ProfileUpdateInput,
          context: unknown,
        ) => void | Promise<void>;
      }) => ({
        isPending: false,
        mutate: async (input: ProfileUpdateInput) => {
          mutateSpy(input);
          const context = config?.onMutate ? await config.onMutate(input) : undefined;
          await config?.onSuccess?.(updatedProfile, input, context);
          await config?.onSettled?.(updatedProfile, null, input, context);
        },
      }),
    },
  },
};

mock.module("@/utils/trpc", () => ({ trpc: trpcMock }));

describe("Profile route", () => {
  beforeEach(() => {
    profileQueryResult = {
      data: {
        ...updatedProfile,
        name: "Alfred Pennyworth",
        email: "alfred@batcave.dev",
      },
      isLoading: false,
      isFetching: false,
    };
    setData.mockClear();
    cancel.mockClear();
    invalidate.mockClear();
    getData.mockReturnValue(profileQueryResult.data);
    mutateSpy.mockClear();
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it("updates profile with trimmed input and optimistic cache", async () => {
    const routeModule = await import("../profile");
    const Component = routeModule.Route.options.component;

    render(<Component />);

    fireEvent.change(screen.getByPlaceholderText("Name"), {
      target: { value: "  Bruce Wayne  " },
    });
    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "  bruce@wayneenterprises.com " },
    });
    fireEvent.change(screen.getByPlaceholderText("Avatar URL"), {
      target: { value: "https://example.com/avatar.png" },
    });
    fireEvent.change(screen.getByPlaceholderText("Timezone (e.g. America/New_York)"), {
      target: { value: "America/New_York" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(setData).toHaveBeenCalled());

    expect(cancel).toHaveBeenCalled();
    expect(mutateSpy).toHaveBeenCalledWith({
      name: "Bruce Wayne",
      email: "bruce@wayneenterprises.com",
      avatar: "https://example.com/avatar.png",
      timezone: "America/New_York",
    });
    expect(setData).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("Profile updated");
  });
});
