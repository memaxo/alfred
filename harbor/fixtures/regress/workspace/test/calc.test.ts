import { describe, expect, it } from "bun:test";
import { add, mul } from "../src/calc";

describe("calc", () => {
  it("add should add", () => {
    // Fail-to-pass: this fails until add() is fixed.
    expect(add(10, 3)).toBe(13);
  });

  it("mul should keep working (regression)", () => {
    // Pass-to-pass: this should never break.
    expect(mul(6, 7)).toBe(42);
  });
});
