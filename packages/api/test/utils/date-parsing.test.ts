import { describe, expect, test } from "bun:test";
import { parseOptionalDate } from "../../src/utils/date-parsing";

describe("parseOptionalDate", () => {
  test("returns undefined for undefined input", () => {
    expect(parseOptionalDate(undefined)).toBeUndefined();
  });

  test("returns null for null input", () => {
    expect(parseOptionalDate(null)).toBeNull();
  });

  test("returns Date for valid datetime string", () => {
    const result = parseOptionalDate("2024-01-01T00:00:00Z");
    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe("2024-01-01T00:00:00.000Z");
  });

  test("handles various datetime formats", () => {
    const iso = parseOptionalDate("2024-01-01T12:34:56.789Z");
    expect(iso).toBeInstanceOf(Date);

    const withOffset = parseOptionalDate("2024-01-01T12:34:56+00:00");
    expect(withOffset).toBeInstanceOf(Date);
  });
});
