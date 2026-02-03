import type { Session, User } from "better-auth/types";

import { createAuthClient } from "better-auth/client";
import { mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  decryptCredentials,
  encryptCredentials,
  isEncrypted,
} from "./encryption";

const ALFRED_DIR = join(homedir(), ".alfred");
const CREDENTIALS_PATH = join(ALFRED_DIR, "credentials.json");

// Service name for OS-level credential storage
const SECRET_SERVICE = "com.alfred.cli";
const SECRET_NAME = "session";

export interface StoredCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  sessionId: string;
  user: User;
  session: Session;
  isLocal?: boolean;
  toolAuthz?: StoredToolAuthz;
}

export interface StoredToolAuthz {
  /** Raw tool JWT returned by token.issue/elevate */
  token: string;
  tokenId?: string;
  scopes: string[];
  issuedAt: number;
  expiresAt: number | null;
  elevated: boolean;
}

/**
 * Loads credentials from OS keychain (via Bun.secrets) with fallback/migration from local file.
 */
export async function loadCredentials(): Promise<StoredCredentials | null> {
  try {
    // 1. Try loading from secure OS storage first
    if (typeof Bun.secrets !== "undefined") {
      const secret = await Bun.secrets.get({
        service: SECRET_SERVICE,
        name: SECRET_NAME,
      });

      if (secret) {
        return JSON.parse(secret);
      }
    }

    // 2. Fallback to file (with encryption if available)
    const file = Bun.file(CREDENTIALS_PATH);
    if (await file.exists()) {
      const content = await file.text();
      let creds: StoredCredentials | null = null;

      if (isEncrypted(content)) {
        creds = await decryptCredentials<StoredCredentials>(content);
      } else {
        // Plaintext fallback for migration
        creds = JSON.parse(content);
      }

      // 3. Auto-migrate to secure storage if available
      if (typeof Bun.secrets !== "undefined" && creds) {
        await storeCredentials(creds);
        // We leave the file for now to be safe, but clearCredentials will remove it
      }

      return creds;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Stores credentials securely in OS keychain.
 */
export async function storeCredentials(
  creds: StoredCredentials
): Promise<void> {
  // 1. Store in secure storage if available
  if (typeof Bun.secrets !== "undefined") {
    await Bun.secrets.set({
      service: SECRET_SERVICE,
      name: SECRET_NAME,
      value: JSON.stringify(creds),
    });
  } else {
    // 2. Fallback to file with encryption
    await mkdir(ALFRED_DIR, { recursive: true, mode: 0o700 });
    const encrypted = await encryptCredentials(creds);
    await Bun.write(CREDENTIALS_PATH, encrypted, {
      mode: 0o600, // Owner read/write only
    });
  }
}

/**
 * Clears credentials from both secure storage and local file.
 */
export async function clearCredentials(): Promise<void> {
  try {
    // 1. Clear from secure storage
    if (typeof Bun.secrets !== "undefined") {
      await Bun.secrets.delete({
        service: SECRET_SERVICE,
        name: SECRET_NAME,
      });
    }

    // 2. Clear from local file
    const file = Bun.file(CREDENTIALS_PATH);
    if (await file.exists()) {
      await rm(CREDENTIALS_PATH, { force: true });
    }
  } catch {
    // Ignore errors
  }
}

export async function refreshIfNeeded(
  creds: StoredCredentials
): Promise<StoredCredentials> {
  // If token expires in less than 5 minutes, refresh
  const REFRESH_THRESHOLD = 5 * 60 * 1000;

  if (creds.expiresAt - Date.now() > REFRESH_THRESHOLD) {
    return creds;
  }

  // Refresh token
  const authClient = createAuthClient({
    baseURL: process.env.ALFRED_API_URL || "http://localhost:3000",
  });

  const { oauth2 } = authClient as unknown as {
    oauth2: {
      refreshToken: (input: { refresh_token: string }) => Promise<{
        data: {
          access_token: string;
          refresh_token?: string;
          expires_in: number;
        };
        error?: unknown;
      }>;
    };
  };

  // Note: better-auth client might have different method names depending on version
  // This follows the plan's recommendation
  const { data: newTokens, error } = await oauth2.refreshToken({
    refresh_token: creds.refreshToken,
  });

  if (error || !newTokens) {
    throw new Error("refresh_failed: Please run 'alfred auth login' again");
  }

  const updated: StoredCredentials = {
    accessToken: newTokens.access_token,
    refreshToken: newTokens.refresh_token ?? creds.refreshToken,
    expiresAt: Date.now() + newTokens.expires_in * 1000,
    sessionId: creds.sessionId,
    user: creds.user,
    session: creds.session, // These would ideally be updated too if the refresh provides them
    isLocal: creds.isLocal,
    toolAuthz: creds.toolAuthz,
  };

  await storeCredentials(updated);
  return updated;
}

export async function storeToolAuthz(
  toolAuthz: StoredToolAuthz | null
): Promise<void> {
  const creds = await loadCredentials();
  if (!creds) {
    throw new Error("credentials_missing");
  }
  const next: StoredCredentials = {
    ...creds,
    toolAuthz: toolAuthz ?? undefined,
  };
  await storeCredentials(next);
}
