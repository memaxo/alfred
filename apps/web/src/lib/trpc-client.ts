import type { appRouter } from "@alfred/api/routers/index";

import {
  createTRPCClient,
  createTRPCProxyClient,
  httpBatchLink,
  splitLink,
  type TRPCClient,
  type TRPCLink,
  unstable_httpSubscriptionLink,
} from "@trpc/client";

// Shared link factory so both React Query hooks and imperative proxy clients
// reuse the same HTTP + subscription transport configuration.
function createBrowserLinks(): TRPCLink<typeof appRouter>[] {
  const subscriptionLink = unstable_httpSubscriptionLink({
    url: "/api/trpc",
  });

  const batchLink = httpBatchLink({
    url: "/api/trpc",
    fetch(url, options) {
      return fetch(url, {
        ...options,
        credentials: "include",
      });
    },
  });

  return [
    splitLink({
      condition: (op) => op.type === "subscription",
      true: subscriptionLink,
      false: batchLink,
    }),
  ];
}

export function createBrowserTrpcClient() {
  return createTRPCClient<typeof appRouter>({
    links: createBrowserLinks(),
  });
}

export function createBrowserTrpcProxyClient() {
  return createTRPCProxyClient<typeof appRouter>({
    links: createBrowserLinks(),
  });
}

export type BrowserTrpcClient = TRPCClient<typeof appRouter>;
