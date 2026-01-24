# native-metro-bundling

Purpose: Keep the iOS native bundle buildable and debuggable under Metro + Expo Updates in a monorepo, without accidental Node-only imports.

## Rules of thumb

- **No `node:*` imports in reachable code.** Any module that can be imported by `apps/native` must not import Node builtins via `node:` (e.g. `node:buffer`, `node:path`). Prefer web APIs or browser-friendly shims like `buffer`.
- **Barrels can pull in “unused” code.** ESM re-exports (`export { x } from "./file"`) load the referenced module; keep client barrels free of server-only helpers.
- **Prefer capability checks.** Avoid globals that don’t exist in React Native (e.g. `DOMException`). Use safe guards like `typeof DOMException !== "undefined"` or fall back to `Error.name`.
- **Metro resolver escapes.** When Metro fails to resolve a dependency due to package metadata quirks, prefer a narrow `resolver.resolveRequest` override in `apps/native/metro.config.js`.

## Known pitfalls and fixes in this repo

- **`node:buffer` breaks Release bundling via Expo Updates**\n+ - Symptom: iOS Release build fails during “Bundle React Native code and images”.\n+ - Fix: replace `node:buffer` with `buffer` (or avoid Buffer entirely) in modules reachable from native (example: `packages/voice/src/audio/resample.ts`).\n+
- **`DOMException` does not exist in React Native**\n+ - Symptom: runtime “Property 'DOMException' doesn't exist” in Debug/Metro.\n+ - Fix: detect abort via `error instanceof Error && error.name === \"AbortError\"` (see `apps/native/lib/health.ts`).\n+
- **Metro mis-resolves `event-target-shim` in some graphs**\n+ - Symptom: Metro error resolving `event-target-shim` from `abort-controller`.\n+ - Fix: force `event-target-shim` to a concrete file path using `resolveRequest` (see `apps/native/metro.config.js`).\n+

## Simulator discipline (xcodebuildmcp)

- Pin **one simulator UUID** for day-to-day runs (e.g. iPhone 17 Pro iOS 26.2) to avoid churn.\n+- Use **Release** builds for “no Metro required” automation.\n+- Use **Debug + Metro** only for smoke and iterative JS/UI work.
