import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import { Platform } from "react-native";

// SecureStore only works on native platforms, not web
const getStorage = () => {
  if (Platform.OS === "web") {
    // Web fallback using localStorage
    return {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => localStorage.setItem(key, value),
      deleteItem: (key: string) => localStorage.removeItem(key),
    };
  }
  // Dynamic import to avoid loading SecureStore on web
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SecureStore = require("expo-secure-store");
  return SecureStore;
};

const baseClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_SERVER_URL,
  plugins: [
    expoClient({
      scheme: "mybettertapp",
      storagePrefix: "alfred",
      storage: getStorage(),
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
        onSuccess?: (context: unknown) => void;
        onFinished?: () => void;
      }
    ) => Promise<{ data?: unknown; error?: unknown }>;
  };
};

export const authClient = baseClient as typeof baseClient & PasskeyMethods;
