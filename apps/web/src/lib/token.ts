import type { AppRouter } from "@alfred/api/routers/index";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { authClient } from "@/lib/auth-client";

const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
    }),
  ],
});

/**
 * Prompt the user for a passkey assertion and exchange for an elevated tool
 * token. Use immediately before calling a sensitive tool (e.g. droid.exec).
 */
export async function getElevatedToolToken(scopes: string[]) {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    throw new Error("scopes_required");
  }

  try {
    await authClient.signIn.passkey({
      autoFill: true,
    });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "passkey_failed");
  }

  const { token } = await trpc.token.elevate.mutate({ scopes });
  return token;
}
