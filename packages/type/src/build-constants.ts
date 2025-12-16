/// <reference path="./build-constants.d.ts" />

/**
 * Build-time constants utility
 * Provides typed access to build metadata injected at compile time
 */

export interface BuildInfo {
  version: string;
  buildTime: string;
  commit: string;
  branch: string;
  nodeEnv: "development" | "production" | "test";
  target?: string;
}

/**
 * Get build information from compile-time constants
 * Returns fallback values if constants are not injected (e.g., in development)
 */
export function getBuildInfo(): BuildInfo {
  return {
    version:
      typeof BUILD_VERSION !== "undefined" ? BUILD_VERSION : "dev",
    buildTime:
      typeof BUILD_TIME !== "undefined"
        ? BUILD_TIME
        : new Date().toISOString(),
    commit:
      typeof GIT_COMMIT !== "undefined" ? GIT_COMMIT : "unknown",
    branch:
      typeof GIT_BRANCH !== "undefined" ? GIT_BRANCH : "unknown",
    nodeEnv:
      typeof NODE_ENV !== "undefined"
        ? NODE_ENV
        : (process.env.NODE_ENV as "development" | "production" | "test") ||
          "development",
    target: typeof BUILD_TARGET !== "undefined" ? BUILD_TARGET : undefined,
  };
}

/**
 * Check if build constants are available (i.e., built with --define flags)
 */
export function hasBuildConstants(): boolean {
  return (
    typeof BUILD_VERSION !== "undefined" &&
    typeof BUILD_TIME !== "undefined" &&
    typeof GIT_COMMIT !== "undefined"
  );
}
