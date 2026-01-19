# Expo Patterns

1. **Auth.** Use the Better Auth Expo client (`@better-auth/expo`) and ensure tokens are stored securely via Expo SecureStore.
2. **Networking.** Communicate with the backend through the shared tRPC client. Configure base URLs via env or Expo config.
3. **Styling.** Prefer NativeWind utility classes. Keep shared styling tokens in a single file to match the web design system where practical.
4. **Platform APIs.** Gate platform-specific capabilities (`Notifications`, `Camera`) behind permission checks and feature flags.
5. **File naming.** Follow the single-word rule for screens and components (e.g. `home.tsx`, `remind.tsx`).
6. **Metro + Node builtins.** Never use `node:*` imports in any module reachable from the native bundle; prefer web APIs or `buffer` and isolate Node-only code behind server-only entrypoints (don’t re-export them from client barrels).
7. **Abort handling.** Treat timeouts/cancels as `error instanceof Error && error.name === "AbortError"`; do not rely on `DOMException` existing in React Native.
8. **Simulator discipline.** Pin exactly one simulator (single UUID) for day-to-day xcodebuildmcp runs; add iPad coverage only after windowing/mindscape foundations are stable.