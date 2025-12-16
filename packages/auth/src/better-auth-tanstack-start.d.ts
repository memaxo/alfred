/**
 * Type declaration for better-auth/tanstack-start
 *
 * This file exists because Bun on Linux doesn't properly resolve
 * the subpath exports in better-auth's package.json. The exports
 * work fine on macOS but fail on Linux CI runners.
 *
 * @see https://github.com/better-auth/better-auth
 */
declare module "better-auth/tanstack-start" {
  import type { BetterAuthPlugin } from "better-auth";

  /**
   * TanStack Start integration for better-auth.
   * Handles cookie management for server-side rendering.
   */
  export function tanstackStartCookies(): BetterAuthPlugin;
}
