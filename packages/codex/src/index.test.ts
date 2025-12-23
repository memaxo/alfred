import { describe, expect, it } from "bun:test";
import { runStreamed } from "./runner";

describe("Codex", () => {
  it("should export runStreamed", () => {
    expect(runStreamed).toBeDefined();
    expect(typeof runStreamed).toBe("function");
  });
});
