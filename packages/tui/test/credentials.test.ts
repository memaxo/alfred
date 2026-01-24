import { afterEach, describe, expect, mock, test } from "bun:test";

import {
  clearCredentials,
  loadCredentials,
  storeCredentials,
} from "../src/cli/credentials";

// Mock Bun.secrets for testing
const mockSecrets = new Map<string, string>();
(Bun as unknown as { secrets: unknown }).secrets = {
  get: mock(({ service, name }: { service: string; name: string }) =>
    Promise.resolve(mockSecrets.get(`${service}:${name}`) || null)
  ),
  set: mock(
    ({
      service,
      name,
      value,
    }: {
      service: string;
      name: string;
      value: string;
    }) => {
      mockSecrets.set(`${service}:${name}`, value);
      return Promise.resolve();
    }
  ),
  delete: mock(({ service, name }: { service: string; name: string }) => {
    mockSecrets.delete(`${service}:${name}`);
    return Promise.resolve();
  }),
};

describe("Credentials", () => {
  const mockCreds = {
    accessToken: "test-access",
    refreshToken: "test-refresh",
    expiresAt: Date.now() + 10_000,
    sessionId: "test-session",
    user: { email: "test@example.com" },
    session: { id: "test-session" },
  };

  afterEach(() => {
    mockSecrets.clear();
  });

  test("can store and load credentials via Bun.secrets", async () => {
    await storeCredentials(mockCreds);
    const loaded = await loadCredentials();
    expect(loaded).toEqual(mockCreds);

    // Verify it used Bun.secrets
    expect(Bun.secrets.set).toHaveBeenCalled();
    expect(Bun.secrets.get).toHaveBeenCalled();
  });

  test("can clear credentials", async () => {
    await storeCredentials(mockCreds);
    await clearCredentials();
    const loaded = await loadCredentials();
    expect(loaded).toBeNull();

    // Verify it used Bun.secrets.delete
    expect(Bun.secrets.delete).toHaveBeenCalled();
  });
});
