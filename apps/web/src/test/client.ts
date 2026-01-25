import type { TRPCClient } from "@trpc/client";

import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";

import type { TRPCAppRouter } from "@/utils/trpc";

import type { TestServer } from "./server";

import {
  createTestSession,
  serializeTestSession,
  TEST_SESSION_HEADER,
  type TestSession,
} from "./auth";

interface CreateClientOptions {
  session?: TestSession;
  headers?: Record<string, string>;
}

export function createTestClient(
  server: TestServer,
  options: CreateClientOptions = {}
): TRPCClient<TRPCAppRouter> {
  const session = options.session ?? server.getSession() ?? createTestSession();
  const sessionHeader = serializeTestSession(session);

  return createTRPCProxyClient<TRPCAppRouter>({
    links: [
      httpBatchLink({
        url: `${server.url}/api/trpc`,
        headers() {
          return {
            ...(options.headers ?? {}),
            [TEST_SESSION_HEADER]: sessionHeader,
          };
        },
      }),
    ],
  });
}
