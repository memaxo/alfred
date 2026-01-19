import { describe, expect, it } from "bun:test";
import { combined } from "../src/index";

describe("combined", () => {
  it("combines parts in a stable order", () => {
    expect(combined()).toBe("abc");
  });
});
