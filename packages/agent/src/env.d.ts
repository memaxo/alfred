/**
 * Bun compile-time feature flag type declarations.
 *
 * Feature flags enable conditional code inclusion at build time:
 * - Production builds exclude legacy code entirely (tree-shaking)
 * - Development builds can include legacy paths for testing
 *
 * Usage:
 *   import { feature } from "bun:bundle";
 *   if (feature("LEGACY_POOF")) { ... }
 *
 * Build commands:
 *   Production: bun build ./src/index.ts --outdir ./dist
 *   Development: bun build --feature=LEGACY_WORKTREE --feature=LEGACY_POOF ./src/index.ts
 */
declare module "bun:bundle" {
  interface Registry {
    features: "LEGACY_WORKTREE" | "LEGACY_POOF" | "DEBUG";
  }

  /**
   * Check if a feature flag is enabled at build time.
   * Returns true if the flag was passed to `bun build --feature=FLAG`.
   * At runtime (without bundling), always returns false.
   */
  export function feature(name: Registry["features"]): boolean;
}
