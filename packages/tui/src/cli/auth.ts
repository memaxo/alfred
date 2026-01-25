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

interface DeviceCode {
  verificationUri: string;
  verificationUriComplete?: string;
  deviceCode: string;
  interval: number;
  expiresIn: number;
}

interface DeviceToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: unknown;
  session: { id: string };
}

interface DeviceAuthClient {
  oauth2: {
    requestDeviceCode: (input: {
      scope: string[];
    }) => Promise<{ data?: DeviceCode; error?: unknown }>;
    pollDeviceToken: (input: {
      deviceCode: string;
      interval: number;
      expiresIn: number;
    }) => Promise<{ data?: DeviceToken; error?: unknown }>;
  };
}

export async function deviceLogin(): Promise<void> {
  const { oauth2 } = authClient as unknown as DeviceAuthClient;

  // 1. Request device code
  const { data: deviceCode, error } = await oauth2.requestDeviceCode({
    scope: ["openid", "profile", "offline_access"],
  });

  if (error || !deviceCode) {
    throw new Error("tui_auth_device_code_request_failed");
  }

  // 3. Open browser automatically
  if (process.env.ALFRED_AUTO_OPEN_BROWSER !== "false") {
    try {
      await openBrowser(
        deviceCode.verificationUriComplete || deviceCode.verificationUri
      );
    } catch {}
  }
  process.stdout.write("  Waiting for authorization");

  // 4. Poll for authorization
  const { data: tokens, error: pollError } = await oauth2.pollDeviceToken({
    deviceCode: deviceCode.deviceCode,
    interval: deviceCode.interval,
    expiresIn: deviceCode.expiresIn,
  });

  if (pollError || !tokens) {
    throw new Error("tui_auth_device_token_poll_failed");
  }

  // 5. Store credentials
  await storeCredentials({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
    sessionId: tokens.session.id,
    user: tokens.user as StoredCredentials["user"],
    session: tokens.session as StoredCredentials["session"],
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
      createdAt: new Date(),
      updatedAt: new Date(),
    } as StoredCredentials["user"],
    session: {
      id: "local-dev-session",
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: "dev-admin-id",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      token: "local-dev-token",
    } as StoredCredentials["session"],
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
