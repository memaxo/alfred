import { describe, expect, it } from "bun:test";
import { Chat, HomePane, NotePane, RemindPane } from "../src";

describe("@alfred/ui scaffolding", () => {
  it("exposes Chat component", () => {
    expect(typeof Chat).toBe("function");
  });

  it("exposes pane components", () => {
    expect(typeof NotePane).toBe("function");
    expect(typeof RemindPane).toBe("function");
    expect(typeof HomePane).toBe("function");
  });
});
