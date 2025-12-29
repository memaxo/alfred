/**
 * MCP OAuth Scopes
 *
 * Defines granular scopes for ALFRED API access.
 * Used by OAuth Provider for MCP client authorization.
 *
 * Scope hierarchy:
 * - `read:*` → All read operations
 * - `write:*` → All write operations
 * - `admin:*` → Administrative operations (require biometric)
 */

// ─── SCOPE CONSTANTS ─────────────────────────────────────────────────────────

/** Standard OIDC scopes */
export const OIDC_SCOPES = {
  OPENID: "openid",
  PROFILE: "profile",
  EMAIL: "email",
  OFFLINE_ACCESS: "offline_access",
} as const;

/** Read scopes - allow reading data */
export const READ_SCOPES = {
  ALL: "read:*",
  TODOS: "read:todos",
  NOTES: "read:notes",
  REMINDERS: "read:reminders",
  KNOWLEDGE: "read:knowledge",
  COGNITIVE: "read:cognitive",
  WORKFLOWS: "read:workflows",
  TIMERS: "read:timers",
  BOOKMARKS: "read:bookmarks",
} as const;

/** Write scopes - allow creating/updating/deleting data */
export const WRITE_SCOPES = {
  ALL: "write:*",
  TODOS: "write:todos",
  NOTES: "write:notes",
  REMINDERS: "write:reminders",
  KNOWLEDGE: "write:knowledge",
  WORKFLOWS: "write:workflows",
  TIMERS: "write:timers",
  BOOKMARKS: "write:bookmarks",
} as const;

/** Admin scopes - require biometric verification */
export const ADMIN_SCOPES = {
  ALL: "admin:*",
  VOICE: "admin:voice",
  WORKFLOW: "admin:workflow",
  DEPLOY: "admin:deploy",
  SYSTEM: "admin:system",
} as const;

// ─── TYPE DEFINITIONS ────────────────────────────────────────────────────────

export type OidcScope = (typeof OIDC_SCOPES)[keyof typeof OIDC_SCOPES];
export type ReadScope = (typeof READ_SCOPES)[keyof typeof READ_SCOPES];
export type WriteScope = (typeof WRITE_SCOPES)[keyof typeof WRITE_SCOPES];
export type AdminScope = (typeof ADMIN_SCOPES)[keyof typeof ADMIN_SCOPES];

export type Scope = OidcScope | ReadScope | WriteScope | AdminScope;

// ─── SCOPE UTILITIES ─────────────────────────────────────────────────────────

/**
 * All supported scopes for OAuth metadata
 */
export const ALL_SCOPES: readonly Scope[] = [
  ...Object.values(OIDC_SCOPES),
  ...Object.values(READ_SCOPES),
  ...Object.values(WRITE_SCOPES),
  ...Object.values(ADMIN_SCOPES),
] as const;

/**
 * Check if granted scopes include the required scope.
 * Supports wildcard resolution (e.g., `read:*` covers `read:todos`).
 *
 * @param granted - Scopes granted to the token
 * @param required - The scope required for the operation
 * @returns true if the required scope is covered by granted scopes
 */
export function hasScope(granted: string[], required: string): boolean {
  // Direct match
  if (granted.includes(required)) {
    return true;
  }

  // Wildcard match (read:* covers read:todos)
  const colonIndex = required.indexOf(":");
  if (colonIndex > 0) {
    const action = required.slice(0, colonIndex);
    if (granted.includes(`${action}:*`)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if granted scopes include all required scopes.
 *
 * @param granted - Scopes granted to the token
 * @param required - Array of scopes required for the operation
 * @returns true if all required scopes are covered
 */
export function hasAllScopes(granted: string[], required: string[]): boolean {
  return required.every((scope) => hasScope(granted, scope));
}

/**
 * Check if a scope is an admin scope (requires biometric).
 */
export function isAdminScope(scope: string): boolean {
  return scope.startsWith("admin:");
}

/**
 * Parse a scope string into its action and resource parts.
 *
 * @example parseScope("read:todos") → { action: "read", resource: "todos" }
 * @example parseScope("openid") → { action: "openid", resource: undefined }
 */
export function parseScope(scope: string): {
  action: string;
  resource: string | undefined;
} {
  const colonIndex = scope.indexOf(":");
  if (colonIndex === -1) {
    return { action: scope, resource: undefined };
  }
  return {
    action: scope.slice(0, colonIndex),
    resource: scope.slice(colonIndex + 1),
  };
}

// ─── ROUTER SCOPE MAPPING ────────────────────────────────────────────────────

/**
 * Maps router names to their required scopes.
 * Used by the TUI and API to determine scope requirements.
 */
export const ROUTER_SCOPES: Record<
  string,
  { read: ReadScope; write?: WriteScope }
> = {
  todo: { read: READ_SCOPES.TODOS, write: WRITE_SCOPES.TODOS },
  note: { read: READ_SCOPES.NOTES, write: WRITE_SCOPES.NOTES },
  remind: { read: READ_SCOPES.REMINDERS, write: WRITE_SCOPES.REMINDERS },
  timer: { read: READ_SCOPES.TIMERS, write: WRITE_SCOPES.TIMERS },
  book: { read: READ_SCOPES.BOOKMARKS, write: WRITE_SCOPES.BOOKMARKS },
  knowledge: { read: READ_SCOPES.KNOWLEDGE, write: WRITE_SCOPES.KNOWLEDGE },
  cognitive: { read: READ_SCOPES.COGNITIVE },
  workflow: { read: READ_SCOPES.WORKFLOWS, write: WRITE_SCOPES.WORKFLOWS },
};

// ─── MCP CLIENT TYPES ────────────────────────────────────────────────────────

/**
 * Predefined scope sets for common MCP client types.
 */
export const MCP_CLIENT_SCOPES = {
  /** Read-only access for analytics/monitoring */
  readonly: [OIDC_SCOPES.OPENID, OIDC_SCOPES.PROFILE, READ_SCOPES.ALL] as const,

  /** Standard assistant access (read + write, no admin) */
  assistant: [
    OIDC_SCOPES.OPENID,
    OIDC_SCOPES.PROFILE,
    OIDC_SCOPES.OFFLINE_ACCESS,
    READ_SCOPES.ALL,
    WRITE_SCOPES.ALL,
  ] as const,

  /** Full access including admin (for trusted first-party clients) */
  full: [
    OIDC_SCOPES.OPENID,
    OIDC_SCOPES.PROFILE,
    OIDC_SCOPES.EMAIL,
    OIDC_SCOPES.OFFLINE_ACCESS,
    READ_SCOPES.ALL,
    WRITE_SCOPES.ALL,
    ADMIN_SCOPES.ALL,
  ] as const,
} as const;
