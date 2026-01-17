import { describe, expect, it } from "bun:test";

describe("sense package boundaries", () => {
  it("does not import server-only packages", async () => {
    const url = new URL("../src/route.ts", import.meta.url);
    const text = await Bun.file(url).text();

    expect(text.includes("@alfred/db")).toBe(false);
    expect(text.includes("@alfred/api")).toBe(false);
  });
});
