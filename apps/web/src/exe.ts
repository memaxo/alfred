/**
 * Executable build entrypoint
 *
 * This file is used only for `bun build --compile` executable builds.
 * It re-exports the server entrypoint and can include feature-gated code
 * using `bun:bundle` feature() for dead code elimination.
 *
 * Usage: bun build --compile --feature=FEATURE_NAME ./apps/web/src/exe.ts
 */

// Re-export server entrypoint
export { default } from "./server";

// Feature-gated code can be added here using:
// import { feature } from "bun:bundle";
// if (feature("FEATURE_NAME")) {
//   // This code is eliminated if --feature=FEATURE_NAME is not provided
// }
