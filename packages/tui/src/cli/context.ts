import type { Context } from "@alfred/api/context";

import { ADMIN_SCOPES, READ_SCOPES, WRITE_SCOPES } from "@alfred/type";
import { RuntimeContext } from "@alfred/type/runtime-context";
import { randomUUID } from "node:crypto";

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

  const defaultRoles = ["owner"] as const;
  const defaultScopes = [
    READ_SCOPES.ALL,
    WRITE_SCOPES.ALL,
    ADMIN_SCOPES.ALL,
  ] as const;

  // 1. Environment variable bypass for local development
  if (process.env.ALFRED_AUTH_BYPASS === "true") {
    return {
      session: {
        user: {
          id: "dev-admin-id",
          email: "admin@alfred.local",
          name: "Bypass Admin",
          emailVerified: true,
          roles: [...defaultRoles],
          scopes: [...defaultScopes],
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

    const user = creds.user as unknown as {
      roles?: unknown;
      scopes?: unknown;
    };

    return {
      session: {
        user: {
          ...creds.user,
          roles: Array.isArray(user.roles) ? user.roles : [...defaultRoles],
          scopes: Array.isArray(user.scopes) ? user.scopes : [...defaultScopes],
        },
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
