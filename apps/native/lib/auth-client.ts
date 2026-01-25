import type { createAuthClient } from "better-auth/react";

import { useAuthClient as useAuthClientBase } from "@/lib/api";

// Type extension for passkey methods that are expected by the codebase
// but missing from the client plugin export in this version.
interface PasskeyMethods {
  passkey: {
    addPasskey: (opts?: {
      name?: string;
    }) => Promise<{ data?: unknown; error?: unknown }>;
    listUserPasskeys: () => Promise<{
      data?: {
        id: string;
        name?: string | null;
        deviceType?: string | null;
        createdAt?: string | Date | null;
      }[];
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
  signIn: {
    passkey: (
      opts: {
        email: string;
        autoFill?: boolean;
      },
      fetchOptions?: {
        onError?: (error: { error?: { message?: string } }) => void;
        onSuccess?: (context: unknown) => void;
        onFinished?: () => void;
      }
    ) => Promise<{ data?: unknown; error?: unknown }>;
  };
}

export type AuthClient = ReturnType<typeof createAuthClient> & PasskeyMethods;

export function useAuthClient(): AuthClient {
  return useAuthClientBase() as unknown as AuthClient;
}
