import { describe, expect, it } from "bun:test";

import {
  coerceBool,
  coerceNonEmptyString,
  coerceRecord,
  toFloat,
  toInt,
} from "../../src/utils/coerce";

describe("coerce utilities", () => {
  describe("coerceRecord", () => {
    it("returns empty object for null", () => {
      expect(coerceRecord(null)).toEqual({});
    });

    it("returns empty object for undefined", () => {
      expect(coerceRecord(undefined)).toEqual({});
    });

    it("returns empty object for empty string", () => {
      expect(coerceRecord("")).toEqual({});
    });

    it("returns the object directly for plain objects", () => {
      const obj = { foo: "bar", num: 42 };
      expect(coerceRecord(obj)).toEqual(obj);
    });

    it("parses valid JSON string to object", () => {
      const json = '{"key": "value", "nested": {"a": 1}}';
      expect(coerceRecord(json)).toEqual({ key: "value", nested: { a: 1 } });
    });

    it("returns empty object for invalid JSON string", () => {
      expect(coerceRecord("{invalid json}")).toEqual({});
      expect(coerceRecord("not json at all")).toEqual({});
    });

    it("returns empty object for JSON array string", () => {
      expect(coerceRecord("[1, 2, 3]")).toEqual({});
    });

    it("returns empty object for JSON primitive string", () => {
      expect(coerceRecord('"just a string"')).toEqual({});
      expect(coerceRecord("42")).toEqual({});
      expect(coerceRecord("true")).toEqual({});
    });

    it("returns empty object for arrays", () => {
      expect(coerceRecord([1, 2, 3])).toEqual({});
      expect(coerceRecord([])).toEqual({});
    });

    it("returns empty object for primitives", () => {
      expect(coerceRecord(42)).toEqual({});
      expect(coerceRecord(true)).toEqual({});
      expect(coerceRecord(false)).toEqual({});
    });

    it("handles nested objects", () => {
      const nested = { a: { b: { c: "deep" } } };
      expect(coerceRecord(nested)).toEqual(nested);
    });

    it("handles objects with null values", () => {
      const obj = { key: null, other: "value" };
      expect(coerceRecord(obj)).toEqual(obj);
    });
  });

  describe("coerceNonEmptyString", () => {
    it("returns null for null input", () => {
      expect(coerceNonEmptyString(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(coerceNonEmptyString(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(coerceNonEmptyString("")).toBeNull();
    });

    it("returns the string for non-empty string", () => {
      expect(coerceNonEmptyString("hello")).toBe("hello");
      expect(coerceNonEmptyString(" ")).toBe(" ");
      expect(coerceNonEmptyString("0")).toBe("0");
    });

    it("returns null for numbers", () => {
      expect(coerceNonEmptyString(42)).toBeNull();
      expect(coerceNonEmptyString(0)).toBeNull();
    });

    it("returns null for booleans", () => {
      expect(coerceNonEmptyString(true)).toBeNull();
      expect(coerceNonEmptyString(false)).toBeNull();
    });

    it("returns null for objects", () => {
      expect(coerceNonEmptyString({})).toBeNull();
      expect(coerceNonEmptyString({ toString: () => "obj" })).toBeNull();
    });

    it("returns null for arrays", () => {
      expect(coerceNonEmptyString([])).toBeNull();
      expect(coerceNonEmptyString(["a", "b"])).toBeNull();
    });
  });

  describe("coerceBool", () => {
    it("returns true for '1'", () => {
      expect(coerceBool("1", false)).toBe(true);
    });

    it("returns true for 'true' (case insensitive)", () => {
      expect(coerceBool("true", false)).toBe(true);
      expect(coerceBool("TRUE", false)).toBe(true);
      expect(coerceBool("True", false)).toBe(true);
    });

    it("returns false for '0'", () => {
      expect(coerceBool("0", true)).toBe(false);
    });

    it("returns false for 'false' (case insensitive)", () => {
      expect(coerceBool("false", true)).toBe(false);
      expect(coerceBool("FALSE", true)).toBe(false);
      expect(coerceBool("False", true)).toBe(false);
    });

    it("returns fallback for undefined", () => {
      expect(coerceBool(undefined, true)).toBe(true);
      expect(coerceBool(undefined, false)).toBe(false);
    });

    it("returns fallback for unrecognized strings", () => {
      expect(coerceBool("yes", false)).toBe(false);
      expect(coerceBool("no", true)).toBe(true);
      expect(coerceBool("", true)).toBe(true);
      expect(coerceBool("2", false)).toBe(false);
    });
  });

  describe("toInt", () => {
    it("parses valid integer strings", () => {
      expect(toInt("42", 0)).toBe(42);
      expect(toInt("-10", 0)).toBe(-10);
      expect(toInt("0", 99)).toBe(0);
    });

    it("returns fallback for undefined", () => {
      expect(toInt(undefined, 100)).toBe(100);
    });

    it("returns fallback for empty string", () => {
      expect(toInt("", 50)).toBe(50);
    });

    it("returns fallback for non-numeric strings", () => {
      expect(toInt("abc", 25)).toBe(25);
      expect(toInt("12abc", 25)).toBe(12); // parseInt behavior
    });

    it("truncates floats to integers", () => {
      expect(toInt("3.14", 0)).toBe(3);
      expect(toInt("9.99", 0)).toBe(9);
    });

    it("returns fallback for NaN-producing inputs", () => {
      expect(toInt("NaN", 5)).toBe(5);
    });
  });

  describe("toFloat", () => {
    it("parses valid float strings", () => {
      expect(toFloat("3.14", 0)).toBe(3.14);
      expect(toFloat("-2.5", 0)).toBe(-2.5);
      expect(toFloat("0.0", 99)).toBe(0);
    });

    it("parses integers as floats", () => {
      expect(toFloat("42", 0)).toBe(42);
    });

    it("returns fallback for undefined", () => {
      expect(toFloat(undefined, 1.5)).toBe(1.5);
    });

    it("returns fallback for empty string", () => {
      expect(toFloat("", 2.5)).toBe(2.5);
    });

    it("returns fallback for non-numeric strings", () => {
      expect(toFloat("abc", 3.5)).toBe(3.5);
    });

    it("handles scientific notation", () => {
      expect(toFloat("1e10", 0)).toBe(1e10);
      expect(toFloat("2.5e-3", 0)).toBe(0.0025);
    });

    it("returns fallback for NaN", () => {
      expect(toFloat("NaN", 4.5)).toBe(4.5);
    });

    it("returns fallback for Infinity", () => {
      expect(toFloat("Infinity", 5.5)).toBe(5.5);
      expect(toFloat("-Infinity", 5.5)).toBe(5.5);
    });
  });
});
