import type { AppRouter } from "@alfred/api";

import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";

export type TRPCAppRouter = AppRouter;

export const trpc = createTRPCReact<AppRouter>();
export const queryClient = new QueryClient();

function base64EncodeUtf8(value: string): string {
  interface BufferLike {
    from: (
      value: string,
      encoding: string
    ) => { toString: (encoding: string) => string };
  }
  const B = (globalThis as unknown as { Buffer?: BufferLike }).Buffer;
  if (B) {
    return B.from(value, "utf8").toString("base64") as string;
  }
  const encode = (globalThis as unknown as { btoa?: (input: string) => string })
    .btoa;
  if (encode) {
    return encode(value);
  }
  throw new Error("base64_encode_unavailable");
}

function getTestSessionHeader(): string | null {
  // Must match `packages/api/src/context.ts` (base64(JSON(session))).
  const session = {
    user: {
      id: "native-test-user",
      email: "native-test-user@alfred.local",
      name: "Native Test User",
      roles: ["owner"],
      scopes: [
        "read:*",
        "write:*",
        "read:agentfs",
        "read:workflows",
        "write:workflows",
        "read:knowledge",
        "write:knowledge",
        "read:notes",
        "write:notes",
        "read:reminders",
        "write:reminders",
        "read:todos",
        "write:todos",
        "read:timers",
        "write:timers",
        "read:bookmarks",
        "write:bookmarks",
        "read:cognitive",
        "assistant.write",
        "assistant.stream",
        "voice.stt",
        "voice.tts",
        "workflow.read",
        "workflow.plan",
        "workflow.execute",
      ],
    },
    session: { id: "native-test-session" },
  };

  return base64EncodeUtf8(JSON.stringify(session));
}

function shouldSendTestSession(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    return url.hostname === "127.0.0.1" || url.hostname === "localhost";
  } catch {
    return false;
  }
}

export function createTrpcClient(
  baseUrl: string,
  getCookie: () => string | null
) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${baseUrl}/api/trpc`,
        headers() {
          const headers = new Map<string, string>();
          const cookies = getCookie();
          if (cookies) {
            headers.set("Cookie", cookies);
          }
          if (shouldSendTestSession(baseUrl)) {
            const testSession = getTestSessionHeader();
            if (testSession) {
              headers.set("x-alfred-test-session", testSession);
            }
          }
          return Object.fromEntries(headers);
        },
      }),
    ],
  });
}
