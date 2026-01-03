import { act, renderHook, waitFor } from "@testing-library/react-native";
import type React from "react";
import { useOnboarding } from "@/hooks/use-onboarding";
import { authClient } from "@/lib/auth-client";
import { TestProviders } from "../utils/test-helpers";

// Mock auth client
jest.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(),
    signIn: {
      email: jest.fn(),
    },
    signOut: jest.fn(),
  },
}));

// Mock SecureStore
import * as SecureStore from "expo-secure-store";

describe("Authentication Integration", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestProviders>{children}</TestProviders>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should handle login flow", async () => {
    const signInMock = authClient.signIn.email as jest.Mock;
    signInMock.mockResolvedValue({ data: { user: { id: "1" } }, error: null });

    await act(async () => {
      await authClient.signIn.email({
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
    (authClient.useSession as jest.Mock).mockReturnValue({
      data: { user: { id: "1", email: "test@example.com" } },
      isLoading: false,
    });

    const { result } = renderHook(() => authClient.useSession(), { wrapper });

    expect(result.current.data?.user.id).toBe("1");
    expect(result.current.data?.user.email).toBe("test@example.com");
  });

  it("should handle onboarding status persistence", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("true");

    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.hasCompletedOnboarding).toBe(true);
    });
  });
});
