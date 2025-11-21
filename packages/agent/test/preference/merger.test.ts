import { describe, expect, it } from "bun:test";
import type { PreferenceDetail, PreferenceKey } from "@alfred/type/preference";
import { mergePreferences } from "../../src/preference/merger";

function mapFromEntries(
  entries: [PreferenceKey, PreferenceDetail][]
): Map<PreferenceKey, PreferenceDetail> {
  return new Map(entries);
}

describe("mergePreferences", () => {
  it("prefers higher priority sources", () => {
    const inferred = mapFromEntries([
      [
        "response.verbosity",
        { value: "concise", source: "inferred", confidence: 0.6 },
      ],
    ]);
    const user = mapFromEntries([
      [
        "response.verbosity",
        { value: "verbose", source: "user", confidence: 0.9 },
      ],
    ]);

    const merged = mergePreferences([inferred, user]);
    expect(merged.get("response.verbosity")?.value).toBe("verbose");
    expect(merged.get("response.verbosity")?.source).toBe("user");
  });

  it("falls back to higher confidence when sources match", () => {
    const learnedLow = mapFromEntries([
      [
        "response.format",
        { value: "paragraph", source: "learned", confidence: 0.6 },
      ],
    ]);
    const learnedHigh = mapFromEntries([
      [
        "response.format",
        { value: "bullet", source: "learned", confidence: 0.9 },
      ],
    ]);

    const merged = mergePreferences([learnedLow, learnedHigh]);
    expect(merged.get("response.format")?.value).toBe("bullet");
    expect(merged.get("response.format")?.confidence).toBeCloseTo(0.9);
  });
});
