import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/client/plugins";
import { openBrowser } from "./browser";
import {
  clearCredentials,
  loadCredentials,
  type StoredCredentials,
  storeCredentials,
} from "./credentials";

const API_URL = process.env.ALFRED_API_URL || "http://localhost:3000";

const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [deviceAuthorizationClient()],
});

export async function deviceLogin(): Promise<void> {
  // 1. Request device code
  const { data: deviceCode, error } = await (
    authClient as any
  ).oauth2.requestDeviceCode({
    scope: ["openid", "profile", "offline_access"],
  });

  if (error || !deviceCode) {
    process.exit(1);
  }

  // 3. Open browser automatically
  if (process.env.ALFRED_AUTO_OPEN_BROWSER !== "false") {
    try {
      await openBrowser(
        deviceCode.verificationUriComplete || deviceCode.verificationUri
      );
    } catch (_err) {}
  }
  process.stdout.write("  Waiting for authorization");

  // 4. Poll for authorization
  const { data: tokens, error: pollError } = await (
    authClient as any
  ).oauth2.pollDeviceToken({
    deviceCode: deviceCode.deviceCode,
    interval: deviceCode.interval,
    expiresIn: deviceCode.expiresIn,
  });

  if (pollError || !tokens) {
    process.exit(1);
  }

  // 5. Store credentials
  await storeCredentials({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
    sessionId: tokens.session.id,
    user: tokens.user,
    session: tokens.session,
  });
}

export async function setupLocalDevAuth(): Promise<void> {
  const adminSession: StoredCredentials = {
    accessToken: "local-dev-token",
    refreshToken: "local-dev-refresh",
    expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    sessionId: "local-dev-session",
    user: {
      id: "dev-admin-id",
      email: "admin@alfred.local",
      name: "Local Admin",
      emailVerified: true,
    },
    session: { id: "local-dev-session" },
    isLocal: true,
  };

  await storeCredentials(adminSession);
}

export async function logout(): Promise<void> {
  await clearCredentials();
}

export async function status(): Promise<void> {
  const creds = await loadCredentials();
  if (!creds) {
    return;
  }

  const expiresIn = Math.floor((creds.expiresAt - Date.now()) / 1000 / 60);
  if (expiresIn <= 0) {
    return;
  }
}
