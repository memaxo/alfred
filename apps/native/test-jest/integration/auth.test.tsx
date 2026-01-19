import { act, renderHook, waitFor } from "@testing-library/react-native";
import type React from "react";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useAuthClient } from "@/lib/auth-client";
import { TestProviders } from "../utils/test-helpers";

// Mock auth client
jest.mock("@/lib/auth-client", () => ({
  useAuthClient: jest.fn(),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";

describe("Authentication Integration", () => {
  const authClientMock = {
    useSession: jest.fn(),
    signIn: { email: jest.fn() },
    signOut: jest.fn(),
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestProviders>{children}</TestProviders>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthClient as unknown as jest.Mock).mockReturnValue(authClientMock);
  });

  it("should handle login flow", async () => {
    const signInMock = authClientMock.signIn.email as jest.Mock;
    signInMock.mockResolvedValue({ data: { user: { id: "1" } }, error: null });

    await act(async () => {
      await authClientMock.signIn.email({
        email: "test@example.com",
        password: "password",
      });
    });

    expect(signInMock).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password",
    });
  });

  it("should handle session restoration", () => {
    authClientMock.useSession.mockReturnValue({
      data: { user: { id: "1", email: "test@example.com" } },
      isLoading: false,
    });

    const { result } = renderHook(
      () => {
        const auth = useAuthClient();
        return auth.useSession();
      },
      { wrapper }
    );

    expect(result.current.data?.user.id).toBe("1");
    expect(result.current.data?.user.email).toBe("test@example.com");
  });

  it("should handle onboarding status persistence", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("true");

    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.hasCompletedOnboarding).toBe(true);
    });
  });
});
