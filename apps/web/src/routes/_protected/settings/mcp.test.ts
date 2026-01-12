import { describe, expect, it } from "bun:test";

describe("settings mcp route", () => {
  it("exports Route", async () => {
    const mod = await import("./mcp");
    expect(mod.Route).toBeTruthy();
  });
});
