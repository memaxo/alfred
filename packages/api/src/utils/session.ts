import type { auth } from "@alfred/auth";

import type { Context } from "../context";

type AuthSession = Awaited<ReturnType<(typeof auth)["api"]["getSession"]>>;

export interface SessionUser {
  id: string;
  roles?: string[];
  scopes?: string[];
  [key: string]: unknown;
}

export function getSessionUser(
  session: AuthSession | null
): SessionUser | null {
  if (!session) {
    return null;
  }
  if (!session.user) {
    return null;
  }
  const user = session.user as unknown as {
    id: string;
    roles?: unknown;
    scopes?: unknown;
  };
  return {
    id: user.id,
    roles: Array.isArray(user.roles) ? user.roles : undefined,
    scopes: Array.isArray(user.scopes) ? user.scopes : undefined,
  };
}

/**
 * Extract the session ID from context.
 * Better Auth stores session ID in different places depending on the auth flow.
 * This helper provides a consistent way to get it without unsafe casts.
 */
export function getSessionId(ctx: Context): string | null {
  if (!ctx.session) {
    return null;
  }
  const sessionRecord = ctx.session.session as
    | { id?: string; token?: string }
    | undefined;
  return sessionRecord?.id ?? sessionRecord?.token ?? null;
}

export function getSessionUserId(user: SessionUser | null): string {
  return user?.id ?? "anonymous";
}

export function getSessionUserRoles(user: SessionUser | null): string[] {
  if (!user?.roles) {
    return [];
  }
  if (!Array.isArray(user.roles)) {
    return [];
  }
  return user.roles
    .filter((role: unknown): role is string => typeof role === "string")
    .map((role: string) => role.trim())
    .filter((role: string) => role.length > 0);
}

export function getSessionUserScopes(
  user: SessionUser | null
): string[] | null {
  if (!user?.scopes) {
    return null;
  }
  return Array.isArray(user.scopes) ? user.scopes : null;
}
