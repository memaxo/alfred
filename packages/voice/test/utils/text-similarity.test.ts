/**
 * Unit tests for text similarity and WER utilities.
 */
import { describe, expect, it } from "bun:test";

import {
  analyzeWer,
  calculateSimilarity,
  calculateWer,
  formatWerAnalysis,
  identifyCommonErrors,
  isAcceptableSimilarity,
  levenshteinDistance,
  normalizeText,
  tokenize,
} from "./text-similarity";

describe("normalizeText", () => {
  it("converts to lowercase", () => {
    expect(normalizeText("Hello World")).toBe("hello world");
    expect(normalizeText("UPPERCASE")).toBe("uppercase");
  });

  it("removes punctuation", () => {
    expect(normalizeText("Hello, world!")).toBe("hello world");
    expect(normalizeText("What's up?")).toBe("whats up");
    expect(normalizeText("test...")).toBe("test");
  });

  it("collapses whitespace", () => {
    expect(normalizeText("hello   world")).toBe("hello world");
    expect(normalizeText("  spaced  out  ")).toBe("spaced out");
    expect(normalizeText("tabs\t\ttoo")).toBe("tabs too");
  });

  it("handles empty string", () => {
    expect(normalizeText("")).toBe("");
  });

  it("handles only punctuation", () => {
    expect(normalizeText("...")).toBe("");
  });

  it("preserves numbers", () => {
    expect(normalizeText("test 123")).toBe("test 123");
    expect(normalizeText("January 15, 2026")).toBe("january 15 2026");
  });
});

describe("tokenize", () => {
  it("splits normalized text into words", () => {
    expect(tokenize("hello world")).toEqual(["hello", "world"]);
  });

  it("normalizes before tokenizing", () => {
    expect(tokenize("Hello, World!")).toEqual(["hello", "world"]);
  });

  it("handles empty string", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("filters empty tokens", () => {
    expect(tokenize("   ")).toEqual([]);
  });

  it("handles single word", () => {
    expect(tokenize("hello")).toEqual(["hello"]);
  });
});

describe("levenshteinDistance", () => {
  it("returns 0 for identical arrays", () => {
    expect(levenshteinDistance(["a", "b", "c"], ["a", "b", "c"])).toBe(0);
  });

  it("returns length of b when a is empty", () => {
    expect(levenshteinDistance([], ["a", "b"])).toBe(2);
  });

  it("returns length of a when b is empty", () => {
    expect(levenshteinDistance(["a", "b"], [])).toBe(2);
  });

  it("calculates single substitution", () => {
    expect(levenshteinDistance(["a"], ["b"])).toBe(1);
  });

  it("calculates single insertion", () => {
    expect(levenshteinDistance(["a"], ["a", "b"])).toBe(1);
  });

  it("calculates single deletion", () => {
    expect(levenshteinDistance(["a", "b"], ["a"])).toBe(1);
  });

  it("handles complex edits", () => {
    // "kitten" -> "sitting" requires 3 edits
    const a = ["k", "i", "t", "t", "e", "n"];
    const b = ["s", "i", "t", "t", "i", "n", "g"];
    expect(levenshteinDistance(a, b)).toBe(3);
  });

  it("handles word-level distance", () => {
    const ref = ["the", "quick", "brown", "fox"];
    const hyp = ["the", "slow", "brown", "dog"];
    // 2 substitutions: quick->slow, fox->dog
    expect(levenshteinDistance(ref, hyp)).toBe(2);
  });
});

describe("calculateWer", () => {
  it("returns 0 for identical texts", () => {
    expect(calculateWer("hello world", "hello world")).toBe(0);
  });

  it("returns 0 for identical texts with different case", () => {
    expect(calculateWer("Hello World", "hello world")).toBe(0);
  });

  it("returns 0 for identical texts with different punctuation", () => {
    expect(calculateWer("Hello, world!", "hello world")).toBe(0);
  });

  it("returns 1 for completely different texts", () => {
    expect(calculateWer("hello", "goodbye")).toBe(1);
  });

  it("calculates WER correctly", () => {
    // Reference: 4 words, 1 substitution
    const wer = calculateWer("the quick brown fox", "the slow brown fox");
    expect(wer).toBe(0.25); // 1/4 = 0.25
  });

  it("handles empty reference", () => {
    expect(calculateWer("", "hello")).toBe(1);
    expect(calculateWer("", "")).toBe(0);
  });

  it("handles empty hypothesis", () => {
    // All words deleted
    expect(calculateWer("hello world", "")).toBe(1);
  });

  it("handles insertions", () => {
    // 2 words reference, 1 insertion
    const wer = calculateWer("hello world", "hello there world");
    expect(wer).toBe(0.5); // 1/2 = 0.5
  });

  it("handles deletions", () => {
    // 3 words reference, 1 deletion
    const wer = calculateWer("hello there world", "hello world");
    expect(wer).toBeCloseTo(0.333, 2); // 1/3 ≈ 0.333
  });
});

describe("calculateSimilarity", () => {
  it("returns 1 for identical texts", () => {
    expect(calculateSimilarity("hello world", "hello world")).toBe(1);
  });

  it("returns 0 for completely different texts", () => {
    expect(calculateSimilarity("hello", "goodbye")).toBe(0);
  });

  it("returns inverse of WER", () => {
    const similarity = calculateSimilarity(
      "the quick brown fox",
      "the slow brown fox"
    );
    expect(similarity).toBe(0.75); // 1 - 0.25 = 0.75
  });

  it("clamps to 0 for WER > 1", () => {
    // This can happen with many insertions
    // 1 reference word, 3 hypothesis words = 2 insertions = 200% WER
    const similarity = calculateSimilarity("hello", "hello there world");
    // WER = 2/1 = 2, similarity = max(0, 1-2) = 0
    expect(similarity).toBe(0);
  });
});

describe("analyzeWer", () => {
  it("returns complete analysis", () => {
    const analysis = analyzeWer("Hello, World!", "hello world");

    expect(analysis.wer).toBe(0);
    expect(analysis.similarity).toBe(1);
    expect(analysis.referenceWords).toBe(2);
    expect(analysis.hypothesisWords).toBe(2);
    expect(analysis.editDistance).toBe(0);
    expect(analysis.normalizedReference).toBe("hello world");
    expect(analysis.normalizedHypothesis).toBe("hello world");
  });

  it("calculates edit distance correctly", () => {
    const analysis = analyzeWer("the quick brown fox", "the slow brown dog");

    expect(analysis.editDistance).toBe(2); // quick->slow, fox->dog
    expect(analysis.wer).toBe(0.5); // 2/4
    expect(analysis.similarity).toBe(0.5);
  });
});

describe("isAcceptableSimilarity", () => {
  it("returns true when similarity exceeds threshold", () => {
    expect(isAcceptableSimilarity("hello world", "hello world", 0.8)).toBe(
      true
    );
  });

  it("returns false when similarity is below threshold", () => {
    expect(isAcceptableSimilarity("hello", "goodbye", 0.8)).toBe(false);
  });

  it("uses default threshold of 0.8", () => {
    // 75% similarity should fail default threshold
    expect(
      isAcceptableSimilarity("the quick brown fox", "the slow brown fox")
    ).toBe(false);
  });

  it("returns true when similarity equals threshold", () => {
    // Need exactly 80% similarity
    // 5 words, 1 error = 80% similarity
    expect(
      isAcceptableSimilarity(
        "one two three four five",
        "one two three four six",
        0.8
      )
    ).toBe(true);
  });
});

describe("formatWerAnalysis", () => {
  it("formats analysis as human-readable string", () => {
    const analysis = analyzeWer("hello world", "hello there");
    const formatted = formatWerAnalysis(analysis);

    expect(formatted).toContain("WER:");
    expect(formatted).toContain("Similarity:");
    expect(formatted).toContain("Reference words: 2");
    expect(formatted).toContain("Hypothesis words: 2");
    expect(formatted).toContain("Edit distance:");
    expect(formatted).toContain('Reference: "hello world"');
    expect(formatted).toContain('Hypothesis: "hello there"');
  });

  it("formats percentages correctly", () => {
    const analysis = analyzeWer("a b c d", "a x c d"); // 25% WER
    const formatted = formatWerAnalysis(analysis);

    expect(formatted).toContain("WER: 25.0%");
    expect(formatted).toContain("Similarity: 75.0%");
  });
});

describe("identifyCommonErrors", () => {
  it("identifies missing words", () => {
    const errors = identifyCommonErrors("hello world", "hello");

    expect(errors).toContain('Missing word: "world"');
  });

  it("identifies extra words", () => {
    const errors = identifyCommonErrors("hello", "hello world");

    expect(errors).toContain('Extra word: "world"');
  });

  it("identifies missing numbers", () => {
    const errors = identifyCommonErrors(
      "meeting at 3 PM on January 15",
      "meeting at three pm on january"
    );

    expect(errors).toContain('Number not transcribed: "3"');
    expect(errors).toContain('Number not transcribed: "15"');
  });

  it("returns empty array for identical texts", () => {
    const errors = identifyCommonErrors("hello world", "hello world");

    // May have some false positives due to normalization
    // but should be minimal for identical texts
    expect(errors.length).toBe(0);
  });

  it("handles substitutions", () => {
    const errors = identifyCommonErrors("the quick fox", "the slow fox");

    expect(errors).toContain('Missing word: "quick"');
    expect(errors).toContain('Extra word: "slow"');
  });
});

describe("edge cases", () => {
  it("handles unicode text", () => {
    // Unicode is stripped by normalization (non-word chars)
    expect(normalizeText("café")).toBe("caf");
    expect(normalizeText("naïve")).toBe("nave");
  });

  it("handles contractions", () => {
    // Apostrophe is removed
    expect(normalizeText("don't")).toBe("dont");
    expect(normalizeText("it's")).toBe("its");
  });

  it("handles very long texts", () => {
    const longRef = new Array(100).fill("word").join(" ");
    const longHyp = new Array(100).fill("word").join(" ");

    const wer = calculateWer(longRef, longHyp);
    expect(wer).toBe(0);
  });

  it("handles repeated words", () => {
    // Tests that duplicate handling works
    const ref = "the the quick fox";
    const hyp = "the quick fox";

    // 1 deletion from 4 words
    const wer = calculateWer(ref, hyp);
    expect(wer).toBe(0.25);
  });
});
