import { passkeyClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { createTestModeFetch, installTestAuthClient } from "@/lib/test-auth";

const customFetchImpl = createTestModeFetch();

export const authClient = installTestAuthClient(
  createAuthClient({
    plugins: [passkeyClient()],
    ...(customFetchImpl ? { customFetchImpl } : {}),
  })
);
