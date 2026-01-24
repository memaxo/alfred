/**
 * Scope Enforcement Middleware
 *
 * tRPC middleware for enforcing OAuth scopes on procedures.
 * Used by MCP clients and external integrations.
 */

import { hasAllScopes, hasScope, isAdminScope } from "@alfred/type";
import { TRPCError } from "@trpc/server";

import type { Context } from "../context";

import { t } from "../trpc";
import { getSessionUser, getSessionUserScopes } from "../utils/session";

type ScopeEnforcementOptions = {
  /**
   * The scope(s) required to access this procedure.
   * Can be a single scope string or an array for multiple required scopes.
   */
  required: string | string[];

  /**
   * If true, requires ALL specified scopes. If false, requires ANY.
   * Default: true (all required)
   */
  requireAll?: boolean;

  /**
   * Custom error message for forbidden access.
   */
  message?: string;
};

/**
 * Middleware factory that enforces scope requirements on procedures.
 *
 * @example
 * // Single scope
 * .use(requireScopes({ required: "read:todos" }))
 *
 * @example
 * // Multiple scopes (all required)
 * .use(requireScopes({ required: ["read:todos", "write:todos"] }))
 *
 * @example
 * // Any of the scopes (OR logic)
 * .use(requireScopes({ required: ["read:todos", "read:notes"], requireAll: false }))
 */
export function requireScopes(options: ScopeEnforcementOptions) {
  const requiredScopes = Array.isArray(options.required)
    ? options.required
    : [options.required];
  const requireAll = options.requireAll ?? true;

  return t.middleware(({ ctx, next }) => {
    // Get scopes from session (works for both session auth and OAuth tokens)
    const sessionUser = getSessionUser(ctx.session);
    const grantedScopes = getSessionUserScopes(sessionUser) ?? [];

    // Check for admin scopes requiring biometric
    const hasAdminRequirement = requiredScopes.some(isAdminScope);
    if (hasAdminRequirement) {
      // Admin scopes require recent biometric verification
      // If there's a pending biometric obligation, the user hasn't verified yet
      const hasPendingBiometric = ctx.policy?.obligations?.some(
        (o) => o.type === "biometric"
      );

      if (hasPendingBiometric && !process.env.BIO_AUTH_BYPASS) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "admin_scope_requires_biometric",
        });
      }
    }

    // Check scope requirements
    let hasRequiredScopes: boolean;
    if (requireAll) {
      hasRequiredScopes = hasAllScopes(grantedScopes, requiredScopes);
    } else {
      hasRequiredScopes = requiredScopes.some((scope) =>
        hasScope(grantedScopes, scope)
      );
    }

    if (!hasRequiredScopes) {
      const message =
        options.message ??
        `scope_required: ${requiredScopes.join(requireAll ? " AND " : " OR ")}`;

      throw new TRPCError({
        code: "FORBIDDEN",
        message,
        cause: {
          required: requiredScopes,
          granted: grantedScopes,
          requireAll,
        },
      });
    }

    return next({
      ctx: {
        ...ctx,
        scopes: grantedScopes,
      },
    });
  });
}

/**
 * Type augmentation for context with scopes.
 */
export type ScopedContext = Context & {
  scopes: string[];
};

/**
 * Helper to create a procedure that requires specific scopes.
 * Combines auth + scope middleware.
 *
 * @example
 * const readTodosProcedure = scopedProcedure("read:todos");
 */
export function scopedProcedure(scope: string | string[]) {
  const { authedProcedure } = require("../trpc");
  return authedProcedure.use(requireScopes({ required: scope }));
}

/**
 * Pre-configured scope requirements for common operations.
 */
export const SCOPE_REQUIREMENTS = {
  // Read operations
  readAgentfs: requireScopes({ required: "read:agentfs" }),
  readTodos: requireScopes({ required: "read:todos" }),
  readNotes: requireScopes({ required: "read:notes" }),
  readReminders: requireScopes({ required: "read:reminders" }),
  readKnowledge: requireScopes({ required: "read:knowledge" }),
  readCognitive: requireScopes({ required: "read:cognitive" }),
  readWorkflows: requireScopes({ required: "read:workflows" }),
  readTimers: requireScopes({ required: "read:timers" }),
  readBookmarks: requireScopes({ required: "read:bookmarks" }),

  // Write operations
  writeTodos: requireScopes({ required: ["read:todos", "write:todos"] }),
  writeNotes: requireScopes({ required: ["read:notes", "write:notes"] }),
  writeReminders: requireScopes({
    required: ["read:reminders", "write:reminders"],
  }),
  writeKnowledge: requireScopes({
    required: ["read:knowledge", "write:knowledge"],
  }),
  writeWorkflows: requireScopes({
    required: ["read:workflows", "write:workflows"],
  }),
  writeTimers: requireScopes({ required: ["read:timers", "write:timers"] }),
  writeBookmarks: requireScopes({
    required: ["read:bookmarks", "write:bookmarks"],
  }),

  // Admin operations
  adminVoice: requireScopes({ required: "admin:voice" }),
  adminWorkflow: requireScopes({ required: "admin:workflow" }),
  adminDeploy: requireScopes({ required: "admin:deploy" }),
  adminSystem: requireScopes({ required: "admin:system" }),
} as const;
