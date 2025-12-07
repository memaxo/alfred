/**
 * Isomorphic environment detection utilities.
 * 
 * These functions use `createIsomorphicFn` to provide environment-specific
 * implementations that are automatically tree-shaken. Server code is removed
 * from client bundles, and client code is removed from server bundles.
 * 
 * Use these for environment detection that needs to work in both server
 * and client contexts.
 */
import { createIsomorphicFn } from "@tanstack/react-start";

/**
 * Check if test mode is enabled.
 * 
 * Server implementation: Checks server-only environment variables.
 * Client implementation: Checks Vite environment variables.
 * 
 * Automatically tree-shaken - server code not included in client bundle.
 */
export const getTestMode = createIsomorphicFn()
  .server(async () => {
    // Dynamic import to avoid bundling server-only code in client
    const {
      getViteTestMode,
      getMindscapeTest,
      getBunTest,
      getNodeEnv,
    } = await import("./server-only");

    const viteTestMode = getViteTestMode();
    const mindscapeTest = getMindscapeTest();
    const bunTest = getBunTest();
    const nodeEnv = getNodeEnv();

    return (
      viteTestMode === "true" ||
      mindscapeTest === "1" ||
      bunTest === "1" ||
      nodeEnv === "test"
    );
  })
  .client(() => {
    const env = import.meta.env;
    return (
      env?.VITE_TEST_MODE === "true" || env?.MINDSCAPE_TEST === "1"
    );
  });

/**
 * Check if window object is available.
 * 
 * Server implementation: Always returns false.
 * Client implementation: Checks if window is defined.
 * 
 * Automatically tree-shaken - server code not included in client bundle.
 */
export const hasWindow = createIsomorphicFn()
  .server(() => false)
  .client(() => typeof window !== "undefined");
