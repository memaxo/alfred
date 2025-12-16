/**
 * Build-time constants declarations
 * These constants are injected at build time via --define flags (Bun) or define config (Vite)
 */

declare const BUILD_VERSION: string;
declare const BUILD_TIME: string;
declare const GIT_COMMIT: string;
declare const GIT_BRANCH: string;
declare const NODE_ENV: "development" | "production" | "test";
declare const BUILD_TARGET: string | undefined;
