/**
 * VCR Module - Record and replay AI provider API calls
 *
 * Usage:
 *
 * ```typescript
 * import { createVCR, withVCR } from "@alfred/test-kit/vcr";
 *
 * // Option 1: Manual control
 * const vcr = createVCR({
 *   cassettePath: "__cassettes__/my-test.json",
 * });
 * await vcr.start();
 * // ... run tests with AI calls ...
 * await vcr.stop();
 *
 * // Option 2: Automatic wrapper
 * await withVCR({ cassettePath: "__cassettes__/my-test.json" }, async (vcr) => {
 *   // ... run tests with AI calls ...
 * });
 * ```
 *
 * Environment variables:
 * - VCR_RECORD=1 or VCR_MODE=record: Enable recording mode
 * - VCR_PASSTHROUGH=1: Disable VCR, make real requests
 * - VCR_MODE=replay (default): Replay recorded responses
 */

export * from "./cassette";
export {
  loadCassette,
  resolveCassettePath,
  saveCassette,
} from "./cassette";
export * from "./hash";
export { defaultMatcher, fuzzyMatcher, hashRequest } from "./hash";
export * from "./recorder";
// Re-export commonly used functions at top level
export { createVCR, VCRRecorder, withVCR } from "./recorder";
export * from "./types";
