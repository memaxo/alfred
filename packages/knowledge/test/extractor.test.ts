import { describe, expect, it } from "bun:test";

import { inferPattern } from "../src/extractor";

describe("inferPattern", () => {
  it("extracts template from similar strings", () => {
    const examples = [
      "meeting with alice at 3pm",
      "meeting with bob at 2pm",
      "meeting with carol at 4pm",
    ];

    const result = inferPattern(examples);

    expect(result).not.toBeNull();
    expect(result?.rule).toContain("meeting");
    expect(result?.rule).toContain("with");
    expect(result?.rule).toContain("at");
  });

  it("returns null when structure diverges", () => {
    const examples = [
      "call mom",
      "finish report",
      "book flights",
    ];

    expect(inferPattern(examples)).toBeNull();
  });
});
