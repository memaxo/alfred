import { randomUUID } from "node:crypto";
import type { Context } from "@alfred/api/context";
import { RuntimeContext } from "@alfred/type/runtime-context";
import { ensureBiometricForAdmin, isAdminCommand } from "./biometric";
import { loadCredentials, refreshIfNeeded } from "./credentials";

export async function createCliContext(
  procedurePath?: string
): Promise<Context> {
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
      } as any,
      runtime: {
        requestId,
        receivedAt,
        method: "CLI",
        url: `cli://${procedurePath ?? "unknown"}`,
        ip: "127.0.0.1",
        forwardedFor: [],
        userAgent: "alfred-cli/1.0.0-bypass",
        referer: null,
      },
      runtimeContext: new RuntimeContext([
        ["requestId", requestId],
        ["receivedAt", receivedAt.toISOString()],
        ["method", "CLI"],
        ["url", `cli://${procedurePath ?? "unknown"}`],
        ["source", "cli-bypass"],
      ]),
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
      requestId,
      receivedAt,
      method: "CLI",
      url: `cli://${procedurePath ?? "unknown"}`,
      ip: "127.0.0.1",
      forwardedFor: [],
      userAgent: "alfred-cli/1.0.0-local",
      referer: null,
    };

    const runtimeContext = new RuntimeContext([
      ["requestId", requestId],
      ["receivedAt", receivedAt.toISOString()],
      ["method", "CLI"],
      ["url", runtime.url],
      ["source", "cli-local"],
    ]);

    return {
      session: {
        user: creds.user,
        session: creds.session,
      } as any,
      runtime,
      runtimeContext,
    };
  }

  // 4. Standard refresh and context creation for online auth
  const session = await refreshIfNeeded(creds);

  // Check biometric for admin commands
  if (procedurePath && isAdminCommand(procedurePath)) {
    await ensureBiometricForAdmin(session.session.id);
  }

  const runtime = {
    requestId,
    receivedAt,
    method: "CLI",
    url: `cli://${procedurePath ?? "unknown"}`,
    ip: "127.0.0.1",
    forwardedFor: [],
    userAgent: "alfred-cli/1.0.0",
    referer: null,
  };

  const runtimeContext = new RuntimeContext([
    ["requestId", requestId],
    ["receivedAt", receivedAt.toISOString()],
    ["method", "CLI"],
    ["url", runtime.url],
    ["source", "cli"],
  ]);

  return {
    session,
    runtime,
    runtimeContext,
  };
}
