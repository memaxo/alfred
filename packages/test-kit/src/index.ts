export * from "./auth/index";
// Export preload utilities for manual mock reset registration
export {
  getMockResetRegistry,
  registerMockReset,
  unregisterMockReset,
} from "./bun/preload";
export * from "./codex/index";
export * from "./cognitive/index";
export * from "./env/index";
export * from "./kinetic/index";
export * from "./logger/index";
export * from "./performance/index";
export * from "./physical/index";
export * from "./playwright/index";
export * from "./redis/index";
export * from "./sandbox/index";
export * from "./vcr/index";
export * from "./voice/index";
export * from "./workflow/runtime-fixture";

/**
 * Manually trigger all registered mock reset functions.
 * Normally called automatically by preload's afterEach,
 * but can be called manually if needed in edge cases.
 */
export function resetAllTestKitMocks(): void {
  const { getMockResetRegistry } = require("./bun/preload");
  const registry = getMockResetRegistry();
  for (const resetFn of registry) {
    try {
      resetFn();
    } catch {
      // ignore individual reset failures
    }
  }
}
