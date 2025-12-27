import { randomUUID } from "node:crypto";
import type { Context } from "@alfred/api/context";
import { RuntimeContext } from "@alfred/type/runtime-context";
import { loadCredentials, refreshIfNeeded } from "./credentials";

function createCliRuntime(requestId: string, receivedAt: Date) {
  return {
    requestId,
    receivedAt,
    method: "CLI",
    url: "cli://alfred",
    ip: "127.0.0.1",
    forwardedFor: [],
    userAgent: "alfred-cli/1.0.0",
    referer: null,
  };
}

function createCliRuntimeContext(
  requestId: string,
  receivedAt: Date,
  source: string
) {
  return new RuntimeContext([
    ["requestId", requestId],
    ["receivedAt", receivedAt.toISOString()],
    ["method", "CLI"],
    ["url", "cli://alfred"],
    ["source", source],
  ]);
}

export function createCliHelpContext(): Context {
  const requestId = `cli-help-${randomUUID()}`;
  const receivedAt = new Date();
  return {
    session: null,
    runtime: createCliRuntime(requestId, receivedAt),
    runtimeContext: createCliRuntimeContext(requestId, receivedAt, "cli-help"),
  };
}

export async function createCliContext(): Promise<Context> {
  const requestId = `cli-${randomUUID()}`;
  const receivedAt = new Date();

  // 1. Environment variable bypass for local development
  if (process.env.ALFRED_AUTH_BYPASS === "true") {
    return {
      session: {
        user: {
          id: "dev-admin-id",
          email: "admin@alfred.local",
          name: "Bypass Admin",
          emailVerified: true,
        },
        session: { id: "bypass-session" },
      } as unknown as NonNullable<Context["session"]>,
      runtime: {
        ...createCliRuntime(requestId, receivedAt),
        userAgent: "alfred-cli/1.0.0-bypass",
      },
      runtimeContext: createCliRuntimeContext(
        requestId,
        receivedAt,
        "cli-bypass"
      ),
    };
  }

  // 2. Load and validate credentials
  const creds = await loadCredentials();
  if (!creds) {
    throw new Error(
      "not_authenticated: Run 'alfred auth login' or 'alfred auth local' first"
    );
  }

  // 3. Handle local test sessions
  if (creds.isLocal) {
    const runtime = {
      ...createCliRuntime(requestId, receivedAt),
      userAgent: "alfred-cli/1.0.0-local",
    };

    const runtimeContext = createCliRuntimeContext(
      requestId,
      receivedAt,
      "cli-local"
    );

    return {
      session: {
        user: creds.user,
        session: creds.session,
      } as unknown as NonNullable<Context["session"]>,
      runtime,
      runtimeContext,
    };
  }

  // 4. Standard refresh and context creation for online auth
  const session = await refreshIfNeeded(creds);

  const runtime = createCliRuntime(requestId, receivedAt);
  const runtimeContext = createCliRuntimeContext(requestId, receivedAt, "cli");

  return {
    session,
    runtime,
    runtimeContext,
  };
}
