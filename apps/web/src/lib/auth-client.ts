import { createAuthClient } from "better-auth/react";
import { createTestModeFetch, installTestAuthClient } from "@/lib/test-auth";

const customFetchImpl = createTestModeFetch();

// Note: passkeyClient plugin should be imported from better-auth/client/plugins
// but the export is missing in version 1.4.5. Using type assertion to extend the client.
const baseClient = createAuthClient({
  plugins: [],
  ...(customFetchImpl ? { customFetchImpl } : {}),
});

// Type extension for passkey methods that are expected by the codebase
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
    passkey: (opts: {
      email: string;
      autoFill?: boolean;
    }) => Promise<{ data?: unknown; error?: unknown }>;
  };
};

export const authClient = installTestAuthClient(
  baseClient as typeof baseClient & PasskeyMethods
);
