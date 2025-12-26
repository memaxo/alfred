import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

const baseClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_SERVER_URL,
  plugins: [
    expoClient({
      scheme: "mybettertapp",
      storagePrefix: "alfred",
      storage: SecureStore,
    }),
  ],
});

// Type extension for passkey methods that are expected by the codebase
// but missing from the client plugin export in this version.
type PasskeyMethods = {
  passkey: {
    addPasskey: (opts?: {
      name?: string;
    }) => Promise<{ data?: unknown; error?: unknown }>;
    listUserPasskeys: () => Promise<{
      data?: Array<{
        id: string;
        name?: string | null;
        deviceType?: string | null;
        createdAt?: string | Date | null;
      }>;
      error?: unknown;
    }>;
    deletePasskey: (opts: {
      id: string;
    }) => Promise<{ data?: unknown; error?: unknown }>;
    updatePasskey: (opts: {
      id: string;
      name: string;
    }) => Promise<{ data?: unknown; error?: unknown }>;
  };
  signIn: typeof baseClient.signIn & {
    passkey: (
      opts: {
        email: string;
        autoFill?: boolean;
      },
      fetchOptions?: {
        onError?: (error: { error: { message?: string } }) => void;
        onSuccess?: (context: any) => void;
        onFinished?: () => void;
      }
    ) => Promise<{ data?: unknown; error?: unknown }>;
  };
};

export const authClient = baseClient as typeof baseClient & PasskeyMethods;
