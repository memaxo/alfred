import type { ResearchResult, ResearchSource } from "./types.js";

/**
 * Deduplicate external and internal research sources
 */
export function deduplicateSources(
  external: ResearchSource[],
  internal: ResearchResult["internal"]
): {
  external: ResearchSource[];
  internal: ResearchResult["internal"];
} {
  // 1. Deduplicate external sources by URL (source field)
  // Keep the one with highest reliability
  const externalMap = new Map<string, ResearchSource>();
  for (const source of external) {
    const existing = externalMap.get(source.source);
    if (!existing || source.reliability > existing.reliability) {
      externalMap.set(source.source, source);
    }
  }

  // 2. Deduplicate internal code paths
  const uniqueCode = Array.from(new Set(internal.existingCode));

  // 3. Cross-source deduplication:
  // If an external source is actually a local file path that we already have in internal,
  // we might want to remove it from external to avoid redundant processing.
  // This depends on how URLs are stored. If they are file:// or just paths.
  const codeSet = new Set(uniqueCode);
  const finalExternal = Array.from(externalMap.values()).filter((ext) => {
    // Basic check for file paths in URL-like strings
    const sourceStr = ext.source.toLowerCase();
    if (sourceStr.startsWith("file://")) {
      const path = sourceStr.replace("file://", "");
      if (codeSet.has(path)) return false;
    }
    // Also check if the ID or source matches an existing internal path
    if (codeSet.has(ext.source) || codeSet.has(ext.id)) return false;
    
    return true;
  });

  // Deduplicate patterns and conventions by ID
  const patternMap = new Map();
  for (const p of internal.patterns) {
    patternMap.set(p.id, p);
  }

  const conventionMap = new Map();
  for (const c of internal.conventions) {
    conventionMap.set(c.id, c);
  }

  return {
    external: finalExternal,
    internal: {
      existingCode: uniqueCode,
      patterns: Array.from(patternMap.values()),
      conventions: Array.from(conventionMap.values()),
    },
  };
}
