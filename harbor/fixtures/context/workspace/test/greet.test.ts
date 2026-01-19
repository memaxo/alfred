import { describe, expect, it } from "bun:test";
import { expected, greet } from "../src/greet";

describe("greet", () => {
  it("returns the expected greeting (derived from local config)", () => {
    expect(greet()).toBe(expected());
  });
});
