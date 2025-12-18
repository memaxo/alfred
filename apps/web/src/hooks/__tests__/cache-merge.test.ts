import { describe, expect, it } from "bun:test";
import { isMergeableRecord, mergeCacheValue } from "../use-assistant-stream";

describe("isMergeableRecord", () => {
  it("correctly identifies mergeable objects", () => {
    expect(isMergeableRecord({})).toBe(true);
    expect(isMergeableRecord({ a: 1 })).toBe(true);
    expect(isMergeableRecord({ nested: { value: 2 } })).toBe(true);
  });

  it("rejects non-mergeable values", () => {
    expect(isMergeableRecord(null)).toBe(false);
    expect(isMergeableRecord(undefined)).toBe(false);
    expect(isMergeableRecord("string")).toBe(false);
    expect(isMergeableRecord(123)).toBe(false);
    expect(isMergeableRecord(true)).toBe(false);
    expect(isMergeableRecord([])).toBe(false);
    expect(isMergeableRecord([1, 2, 3])).toBe(false);
  });
});

describe("mergeCacheValue", () => {
  it("merges two objects correctly", () => {
    const current = { a: 1, b: 2 };
    const newValue = { b: 3, c: 4 };
    const result = mergeCacheValue(current, newValue);
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it("returns newValue when current is not mergeable", () => {
    const current: null = null;
    const newValue = { a: 1 };
    const result = mergeCacheValue(current, newValue);
    expect(result).toBe(newValue);
  });

  it("returns newValue when newValue is not mergeable", () => {
    const current = { a: 1 };
    const newValue = "string";
    const result = mergeCacheValue(current, newValue);
    expect(result).toBe(newValue);
  });

  it("returns newValue when both are not mergeable", () => {
    const current: null = null;
    const newValue = 123;
    const result = mergeCacheValue(current, newValue);
    expect(result).toBe(newValue);
  });

  it("handles null gracefully", () => {
    const current = { a: 1 };
    const newValue: null = null;
    const result = mergeCacheValue(current, newValue);
    expect(result).toBe(null);
  });

  it("handles undefined gracefully", () => {
    const current = { a: 1 };
    const newValue = undefined;
    const result = mergeCacheValue(current, newValue);
    expect(result).toBe(undefined);
  });

  it("preserves nested structures", () => {
    const current = { nested: { a: 1, b: 2 } };
    const newValue = { nested: { b: 3, c: 4 } };
    const result = mergeCacheValue(current, newValue);
    expect(result).toEqual({ nested: { b: 3, c: 4 } });
  });

  it("handles empty objects", () => {
    const current = {};
    const newValue = {};
    const result = mergeCacheValue(current, newValue);
    expect(result).toEqual({});
  });

  it("overwrites existing keys", () => {
    const current = { key: "old" };
    const newValue = { key: "new" };
    const result = mergeCacheValue(current, newValue);
    expect(result).toEqual({ key: "new" });
  });

  it("handles arrays in objects", () => {
    const current = { items: [1, 2] };
    const newValue = { items: [3, 4] };
    const result = mergeCacheValue(current, newValue);
    expect(result).toEqual({ items: [3, 4] });
  });

  it("handles mixed types", () => {
    const current = { string: "a", number: 1, boolean: true };
    const newValue = { string: "b", number: 2 };
    const result = mergeCacheValue(current, newValue);
    expect(result).toEqual({ string: "b", number: 2, boolean: true });
  });
});
