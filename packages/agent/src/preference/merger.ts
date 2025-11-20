import type {
  PreferenceDetail,
  PreferenceKey,
  PreferenceSource,
} from "@alfred/type/preference";

const SOURCE_PRIORITY: Record<PreferenceSource, number> = {
  user: 3,
  learned: 2,
  inferred: 1,
  default: 0,
};

function getPriority(source: PreferenceSource): number {
  return SOURCE_PRIORITY[source] ?? -1;
}

/**
 * Merge preference maps with precedence `user > learned > inferred > default`
 * and confidence as the secondary tiebreaker. Pure and deterministic.
 */
export function mergePreferences(
  preferenceMaps: Array<Map<PreferenceKey, PreferenceDetail>>
): Map<PreferenceKey, PreferenceDetail> {
  const merged = new Map<PreferenceKey, PreferenceDetail>();

  for (const map of preferenceMaps) {
    for (const [key, candidate] of map) {
      const existing = merged.get(key);

      if (!existing) {
        merged.set(key, candidate);
        continue;
      }

      const existingPriority = getPriority(existing.source);
      const candidatePriority = getPriority(candidate.source);

      if (candidatePriority > existingPriority) {
        merged.set(key, candidate);
        continue;
      }

      if (candidatePriority < existingPriority) {
        continue;
      }

      if ((candidate.confidence ?? 0) > (existing.confidence ?? 0)) {
        merged.set(key, candidate);
      }
    }
  }

  return merged;
}
