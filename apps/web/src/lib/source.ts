/**
 * Fumadocs source configuration
 */
import { loader } from "fumadocs-core/source";

export const source = loader({
  // Fallback source (keeps SSR and search route bootable even if docs are not wired).
  source: { files: [] },
  baseUrl: "/docs",
});
