/**
 * `bun:bundle` compatibility shim.
 *
 * Bun versions without native `bun:bundle` support resolve `bun:bundle` as the
 * bare specifier `bundle`. This workspace package exists to keep tests runnable
 * in those environments by providing a minimal `feature()` API.
 *
 * When Bun supports `bun:bundle` natively, this package is effectively unused.
 */

export const Registry = {
  features: [] as const,
} as const;

export function feature(_name: string): boolean {
  return false;
}

