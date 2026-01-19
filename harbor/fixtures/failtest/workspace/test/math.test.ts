import { describe, expect, it } from "bun:test";
import { add } from "../src/math";

describe("add", () => {
  it("adds two numbers", () => {
    expect(add(3, 4)).toBe(7);
  });
});
