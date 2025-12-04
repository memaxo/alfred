/**
 * Fumadocs source configuration
 * NOTE: Fumadocs collections are not properly configured (missing source.config.ts)
 * Using empty source as fallback until fumadocs is properly set up
 * TODO: Create source.config.ts to enable fumadocs documentation
 */
import { loader } from "fumadocs-core/source";

// Empty source - fumadocs collections not configured
// The generated .source/ files don't export any collections
export const source = loader({
  source: { files: [] },
  baseUrl: "/docs",
});
