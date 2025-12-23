import { describe, expect, it } from "bun:test";

import { calculateError } from "../src/state/error";

describe("calculateError", () => {
  it("returns 0 for identical strings", () => {
    expect(calculateError("hello", "hello")).toBe(0);
    expect(calculateError("", "")).toBe(0);
    expect(calculateError("a", "a")).toBe(0);
  });

  it("returns 1 when one string is empty and other is not", () => {
    expect(calculateError("hello", "")).toBe(1);
    expect(calculateError("", "world")).toBe(1);
  });

  it("calculates normalized Levenshtein distance", () => {
    // "cat" -> "hat" = 1 edit, max length 3
    expect(calculateError("cat", "hat")).toBeCloseTo(1 / 3, 8);

    // "kitten" -> "sitting" = 3 edits, max length 7
    expect(calculateError("kitten", "sitting")).toBeCloseTo(3 / 7, 8);
  });

  it("is symmetric", () => {
    expect(calculateError("abc", "xyz")).toBe(calculateError("xyz", "abc"));
    expect(calculateError("hello", "hallo")).toBe(
      calculateError("hallo", "hello")
    );
  });

  it("handles single character differences", () => {
    expect(calculateError("a", "b")).toBe(1);
    expect(calculateError("ab", "ac")).toBe(0.5);
  });

  it("handles insertions", () => {
    // "abc" -> "abcd" = 1 insertion, max length 4
    expect(calculateError("abc", "abcd")).toBeCloseTo(1 / 4, 8);
  });

  it("handles deletions", () => {
    // "abcd" -> "abc" = 1 deletion, max length 4
    expect(calculateError("abcd", "abc")).toBeCloseTo(1 / 4, 8);
  });

  it("handles complete replacement", () => {
    expect(calculateError("aaa", "bbb")).toBe(1);
  });

  it("handles unicode characters", () => {
    expect(calculateError("café", "cafe")).toBeCloseTo(1 / 4, 8);
  });

  it("handles longer strings efficiently", () => {
    const a = "the quick brown fox jumps over the lazy dog";
    const b = "the quick brown cat jumps over the lazy dog";
    // 3 character substitution (fox -> cat)
    const result = calculateError(a, b);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(0.1);
  });
});
