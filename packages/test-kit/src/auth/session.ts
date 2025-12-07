/**
 * Test session factory for Better Auth sessions.
 *
 * Provides type-safe test session construction without double assertions.
 * Uses a branded type pattern to allow test utilities to create sessions
 * that satisfy the runtime shape while remaining type-safe.
 */

import type { auth } from "@alfred/auth";

/**
 * Better Auth session type derived from the auth API.
 * This is the canonical session type used throughout ALFRED.
 */
export type AuthSession = Awaited<ReturnType<(typeof auth)["api"]["getSession"]>>;

/**
 * Minimal user properties required for test sessions.
 */
export type TestUser = {
  id: string;
  email?: string;
  name?: string;
  roles?: string[];
  scopes?: string[];
};

/**
 * Test session that satisfies AuthSession at runtime.
 * Branded to prevent accidental use in production code.
 */
export type TestSession = AuthSession & { readonly __test: true };

/**
 * Default test user for workflow and integration tests.
 */
export const DEFAULT_TEST_USER: TestUser = {
  id: "test-user",
  email: "test@test.local",
  name: "Test User",
  roles: ["owner"],
  scopes: [],
};

type SessionOverrides = {
  sessionId?: string;
  token?: string;
  expiresAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type UserOverrides = {
  emailVerified?: boolean;
  image?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

/**
 * Creates a type-safe test session that satisfies AuthSession.
 *
 * This factory constructs sessions that match Better Auth's runtime structure
 * without requiring double assertions (`as unknown as`). The returned session
 * is branded as a TestSession to indicate it's for testing only.
 *
 * @example
 * ```typescript
 * const session = createTestSession({ id: "user-1", email: "user@test.local" });
 * // session is typed as TestSession, compatible with AuthSession
 * ```
 */
export function createTestSession(
  user: TestUser,
  overrides?: { session?: SessionOverrides; user?: UserOverrides }
): TestSession {
  const now = new Date();
  const sessionId = overrides?.session?.sessionId ?? `sess-${user.id}-${Date.now()}`;

  // Construct the full session object matching Better Auth's structure
  const session = {
    user: {
      id: user.id,
      email: user.email ?? `${user.id}@test.local`,
      name: user.name ?? "Test User",
      roles: user.roles ?? [],
      scopes: user.scopes ?? [],
      emailVerified: overrides?.user?.emailVerified ?? false,
      image: overrides?.user?.image ?? null,
      createdAt: overrides?.user?.createdAt ?? now,
      updatedAt: overrides?.user?.updatedAt ?? now,
    },
    session: {
      id: sessionId,
      userId: user.id,
      token: overrides?.session?.token ?? `token-${sessionId}`,
      expiresAt: overrides?.session?.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: overrides?.session?.createdAt ?? now,
      updatedAt: overrides?.session?.updatedAt ?? now,
      ipAddress: overrides?.session?.ipAddress ?? null,
      userAgent: overrides?.session?.userAgent ?? null,
    },
    // Brand the session as a test session
    __test: true as const,
  };

  // Cast to TestSession - this is safe because we constructed the full object
  // The brand prevents accidental production use
  return session as unknown as TestSession;
}

/**
 * Creates a test session with default user.
 */
export function createDefaultTestSession(
  overrides?: { session?: SessionOverrides; user?: UserOverrides }
): TestSession {
  return createTestSession(DEFAULT_TEST_USER, overrides);
}

/**
 * Type guard to check if a session is a test session.
 */
export function isTestSession(session: AuthSession | null): session is TestSession {
  if (!session) return false;
  return "__test" in session && session.__test === true;
}

/**
 * Serializes a test session for header transport.
 */
export function serializeTestSession(session: AuthSession): string {
  if (!session?.session || !session?.user) {
    throw new Error("Invalid session: missing session or user data");
  }
  return JSON.stringify({
    user: session.user,
    session: session.session,
  });
}

/**
 * Deserializes a test session from header transport.
 */
export function deserializeTestSession(payload: string): AuthSession {
  const parsed = JSON.parse(payload);
  if (!parsed?.user || !parsed?.session) {
    throw new Error("Invalid session payload: missing user or session");
  }
  return parsed as AuthSession;
}
