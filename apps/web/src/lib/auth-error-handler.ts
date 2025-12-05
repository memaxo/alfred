import { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";

/**
 * Handles authentication errors from tRPC calls.
 * Returns true if the error was an auth error and was handled.
 */
export function handleAuthError(error: unknown): boolean {
  if (!(error instanceof TRPCClientError)) {
    return false;
  }

  const errorData = error.data as { code?: string } | undefined;
  const isUnauthorized = errorData?.code === "UNAUTHORIZED";

  if (isUnauthorized) {
    toast.error("Session expired. Redirecting to login...");
    // Use window.location for a full page reload to clear any stale state
    window.location.href = "/login";
    return true;
  }

  return false;
}

/**
 * Creates a global error handler for React Query that handles auth errors.
 * Use this in your QueryClient configuration.
 */
export function createAuthErrorHandler() {
  return (error: unknown) => {
    handleAuthError(error);
  };
}
