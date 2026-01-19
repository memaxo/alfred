/**
 * Browser stub for `node:module`.
 *
 * Some dependencies (or dev-only code paths) may import `node:module` to access
 * `createRequire`. In the browser we can't support CommonJS `require`, but we
 * can provide a compatible symbol so the import itself doesn't crash the app.
 *
 * This is intended for test/dev safety only.
 */

export type RequireFn = (id: string) => never;

export function createRequire(_url: string | URL): RequireFn {
  return (_id: string) => {
    throw new Error("require_unavailable_in_browser");
  };
}
