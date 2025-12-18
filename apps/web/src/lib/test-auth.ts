export const TEST_SESSION_HEADER = "x-alfred-test-session";
const TEST_SESSION_STORAGE_KEY = "alfred:test-session";
const DEFAULT_SCOPES = ["assistant.write", "assistant.stream"] as const;
const DEFAULT_ROLES = ["owner"] as const;

export type TestSessionUser = {
  id: string;
  email: string;
  name: string;
  roles: string[];
  scopes: string[];
};

export type TestSession = {
  user: TestSessionUser;
  session: {
    id: string;
  };
};

export type TestPasskey = {
  id: string;
  name: string;
  deviceType?: string;
  createdAt?: string;
};

type SessionCarrier = {
  data: TestSession;
};

declare global {
  // eslint-disable-next-line no-var
  var __TEST_SESSION__: SessionCarrier | undefined;
}

const passkeyState: { current: TestPasskey[] } = {
  current: [],
};

export function setTestPasskeys(passkeys: TestPasskey[]) {
  passkeyState.current = [...passkeys];
}

export function getTestPasskeys(): TestPasskey[] {
  return [...passkeyState.current];
}

import { hasWindow as hasWindowIsomorphic } from "@/lib/env/isomorphic";

const fallbackFetch = globalThis.fetch?.bind(globalThis);

/**
 * Check if window object is available.
 * Uses isomorphic utility for proper tree-shaking.
 */
function hasWindow() {
  return hasWindowIsomorphic();
}

function createRandomId(prefix: string) {
  if (typeof globalThis.crypto !== "undefined") {
    const nativeCrypto = globalThis.crypto as Crypto;
    if (typeof nativeCrypto.randomUUID === "function") {
      return nativeCrypto.randomUUID();
    }
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function base64Encode(value: string) {
  if (typeof btoa === "function") {
    return btoa(value);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64");
  }
  throw new Error("base64_encode_unavailable");
}

function base64Decode(value: string) {
  if (typeof atob === "function") {
    return atob(value);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "base64").toString("utf8");
  }
  throw new Error("base64_decode_unavailable");
}

/**
 * Get environment variable value.
 * Uses isomorphic pattern for proper tree-shaking.
 * Server implementation checks process.env.
 * Client implementation uses import.meta.env.
 *
 * Note: This function remains synchronous for compatibility with existing callers.
 * For async server-only access, use server-only utilities directly.
 */
function getEnv(key: string): string | undefined {
  // Server-side: check process.env
  if (typeof process !== "undefined" && process.env?.[key]) {
    return process.env[key];
  }
  // Client-side: check import.meta.env
  if (typeof import.meta !== "undefined") {
    const env = (import.meta as ImportMeta & { env?: Record<string, string> })
      .env;
    if (env && key in env) {
      return env[key];
    }
    const viteKey = `VITE_${key}`;
    if (env && viteKey in env) {
      return env[viteKey];
    }
  }
  return;
}

/**
 * Check if test mode is enabled.
 *
 * Uses isomorphic hasWindow utility and synchronous environment checks.
 * For server-side async test mode detection, use getTestMode from isomorphic utilities.
 */
function isTestModeEnabled(): boolean {
  const explicit = getEnv("VITE_TEST_MODE") ?? getEnv("TEST_MODE");
  const realAuth =
    getEnv("PLAYWRIGHT_REAL_AUTH") ?? getEnv("VITE_PLAYWRIGHT_REAL_AUTH");
  if (realAuth === "1") {
    return false;
  }
  if (explicit === "true" || explicit === "1") {
    return true;
  }
  if (hasWindow()) {
    // Fallback for Playwright and other harnesses that inject sessions directly.
    // This keeps test auth robust even when VITE_TEST_MODE isn't plumbed through.
    try {
      if (window.sessionStorage.getItem(TEST_SESSION_STORAGE_KEY)) {
        return true;
      }
    } catch (_error) {
      // ignore storage failures
    }
    if (globalThis.__TEST_SESSION__?.data) {
      return true;
    }
  }
  return false;
}

function ensureSession(): TestSession {
  const existing = getTestSession();
  if (existing) {
    return existing;
  }
  return issueTestSession();
}

export function setTestSession(session: TestSession) {
  globalThis.__TEST_SESSION__ = { data: session };
  if (hasWindow()) {
    try {
      window.sessionStorage.setItem(
        TEST_SESSION_STORAGE_KEY,
        serializeTestSession(session)
      );
    } catch (_error) {
      // ignore storage failures
    }
  }
}

export function getTestSession(): TestSession | null {
  return globalThis.__TEST_SESSION__?.data ?? null;
}

export function clearTestSession() {
  globalThis.__TEST_SESSION__ = undefined;
  if (hasWindow()) {
    try {
      window.sessionStorage.removeItem(TEST_SESSION_STORAGE_KEY);
    } catch (_error) {
      // ignore storage failures
    }
  }
}

export function serializeTestSession(session: TestSession): string {
  return base64Encode(JSON.stringify(session));
}

export function deserializeTestSession(
  value: string | null
): TestSession | null {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(base64Decode(value)) as TestSession;
  } catch (_error) {
    return null;
  }
}

export function issueTestSession(
  overrides: Partial<TestSessionUser & { sessionId: string }> = {}
): TestSession {
  const id = overrides.id ?? createRandomId("user");
  const session: TestSession = {
    user: {
      id,
      email: overrides.email ?? `${id}@example.com`,
      name: overrides.name ?? "Test User",
      roles: overrides.roles ?? [...DEFAULT_ROLES],
      scopes: overrides.scopes ?? [...DEFAULT_SCOPES],
    },
    session: {
      id: overrides.sessionId ?? createRandomId("sess"),
    },
  };
  setTestSession(session);
  return session;
}

function shouldAttachHeader(url: URL) {
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return true;
  }
  if (hasWindow()) {
    return url.origin === window.location.origin;
  }
  return false;
}

function resolveUrl(target: RequestInfo | URL): URL | null {
  if (typeof target === "string") {
    try {
      if (target.startsWith("http://") || target.startsWith("https://")) {
        return new URL(target);
      }
      return new URL(target, "http://localhost");
    } catch (_error) {
      return null;
    }
  }
  if (target instanceof URL) {
    return target;
  }
  if (target instanceof Request) {
    try {
      return new URL(target.url);
    } catch (_error) {
      return null;
    }
  }
  return null;
}

export function createTestModeFetch(): typeof fetch | undefined {
  if (!isTestModeEnabled()) {
    return;
  }
  if (!fallbackFetch) {
    return;
  }
  // Return a fetch-compatible function
  // Note: TypeScript may complain about missing fetch properties (preconnect, etc.)
  // but these are not used in practice
  const testFetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const serialized = getSerializedTestSession();
    const url = resolveUrl(input);
    if (!(serialized && url && shouldAttachHeader(url))) {
      return fallbackFetch(input as RequestInfo, init);
    }
    if (input instanceof Request) {
      const headers = new Headers(input.headers);
      headers.set(TEST_SESSION_HEADER, serialized);
      const nextRequest = new Request(input, { headers });
      return fallbackFetch(nextRequest, init);
    }
    const headers = new Headers(init?.headers ?? {});
    headers.set(TEST_SESSION_HEADER, serialized);
    return fallbackFetch(input as RequestInfo, {
      ...init,
      headers,
    });
  };

  // Copy fetch properties if they exist (for TypeScript compatibility)
  return testFetch as typeof fetch;
}

function getSerializedTestSession() {
  const session = getTestSession();
  if (!session) {
    return null;
  }
  return serializeTestSession(session);
}

function createPasskey(name: string): TestPasskey {
  return {
    id: createRandomId("passkey"),
    name,
    deviceType: "security-key",
    createdAt: new Date().toISOString(),
  };
}

function getPasskeyApi() {
  return {
    listUserPasskeys: () =>
      Promise.resolve({ data: [...passkeyState.current] }),
    addPasskey: ({ name }: { name: string }) => {
      const next = createPasskey(name);
      passkeyState.current = [next, ...passkeyState.current];
      return Promise.resolve({ data: next });
    },
    deletePasskey: ({ id }: { id: string }) => {
      passkeyState.current = passkeyState.current.filter(
        (record) => record.id !== id
      );
      return Promise.resolve({ data: { removed: 1 } });
    },
  };
}

function getSessionHookResult() {
  const session = getTestSession();
  return {
    data: session,
    isPending: false,
    isError: false,
    error: null,
  };
}

export function installTestAuthClient<T>(client: T): T {
  if (!isTestModeEnabled()) {
    return client;
  }

  ensureSession();
  const passkey = getPasskeyApi();

  Object.assign(client as Record<string, unknown>, {
    getSession: () => Promise.resolve({ data: getTestSession() }),
    useSession: () => getSessionHookResult(),
    signIn: {
      email: () => Promise.resolve({ data: getTestSession() }),
      passkey: () => Promise.resolve({ data: getTestSession() }),
    },
    signUp: {
      email: ({ email, name }: { email: string; name: string }) => {
        const session = issueTestSession({ email, name });
        return Promise.resolve({ data: session });
      },
    },
    signOut: ({
      fetchOptions,
    }: {
      fetchOptions?: { onSuccess?: () => void };
    } = {}) => {
      clearTestSession();
      fetchOptions?.onSuccess?.();
      return Promise.resolve({ data: null });
    },
    passkey,
  });

  return client;
}

export async function withRequestTestSession<T>(
  request: Request,
  handler: () => Promise<T> | T
): Promise<T> {
  if (!isTestModeEnabled()) {
    return handler();
  }
  const serialized = request.headers.get(TEST_SESSION_HEADER);
  const parsed = deserializeTestSession(serialized);
  if (!parsed) {
    return handler();
  }
  const previous = getTestSession();
  setTestSession(parsed);
  try {
    return await handler();
  } finally {
    if (previous) {
      setTestSession(previous);
    } else {
      clearTestSession();
    }
  }
}
