/**
 * Browser stub for @alfred/db to prevent accidental client-side usage.
 */

export function notSupported(): never {
  throw new Error(
    "@alfred/db is server-only and cannot be imported in the browser."
  );
}

export default notSupported;
