import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { inferRouterInputs } from "@trpc/server";
import { authClient } from "@/lib/auth-client";
import type { TRPCAppRouter } from "@/utils/trpc";

const trpc = createTRPCProxyClient<TRPCAppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});

function assertScopes(scopes: string[]) {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    throw new Error("scopes_required");
  }
}

type RouterInputs = inferRouterInputs<TRPCAppRouter>;
type AutoLevel = "read" | "low" | "medium" | "high";

type ToolTokenOptions = {
  forceElevated?: boolean;
  ttlSec?: number;
};

function getTokenClient() {
  const tokenRouter = (trpc as unknown as Record<string, unknown>).token;
  if (
    !tokenRouter ||
    typeof tokenRouter !== "object" ||
    typeof (tokenRouter as any).issue?.mutate !== "function" ||
    typeof (tokenRouter as any).elevate?.mutate !== "function"
  ) {
    throw new Error("token_router_unavailable");
  }
  return tokenRouter as {
    issue: {
      mutate: (
        input: RouterInputs["token"]["issue"]
      ) => Promise<{ token: string }>;
    };
    elevate: {
      mutate: (
        input: RouterInputs["token"]["elevate"]
      ) => Promise<{ token: string }>;
    };
  };
}

export async function getToolToken(
  scopes: string[],
  auto: AutoLevel,
  options?: ToolTokenOptions
) {
  assertScopes(scopes);

  const tokenClient = getTokenClient();
  const forceElevated = Boolean(options?.forceElevated);
  const ttlSec = options?.ttlSec;
  const requiresElevation =
    forceElevated || auto === "medium" || auto === "high";

  if (requiresElevation) {
    try {
      const maybePasskey =
        typeof authClient.signIn === "object" && authClient.signIn !== null
          ? (authClient.signIn as Record<string, unknown>).passkey
          : undefined;
      if (typeof maybePasskey === "function") {
        await maybePasskey({ autoFill: true });
      }
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "passkey_failed"
      );
    }
    const payload: RouterInputs["token"]["elevate"] = ttlSec
      ? { scopes, ttlSec }
      : { scopes };
    const { token } = await tokenClient.elevate.mutate(payload);
    return token;
  }

  const issuePayload: RouterInputs["token"]["issue"] = ttlSec
    ? { scopes, ttlSec }
    : { scopes };
  const { token } = await tokenClient.issue.mutate(issuePayload);
  return token;
}

/**
 * Backwards-compatible helper used in dev tools to mint elevated tokens.
 */
export async function getElevatedToolToken(scopes: string[]) {
  return getToolToken(scopes, "medium", { forceElevated: true });
}
