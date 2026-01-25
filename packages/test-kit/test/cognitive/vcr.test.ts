import { afterAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { CognitiveVCR, type Interaction } from "../../src/cognitive/vcr";

describe("Cognitive VCR", () => {
  const TEST_CASSETTE = "unit-test-cassette";
  const cassettePath = path.join(
    process.cwd(),
    "packages/test-kit/cassettes",
    `${TEST_CASSETTE}.json`
  );

  afterAll(async () => {
    try {
      await fs.unlink(cassettePath);
    } catch {}
  });

  it("records interactions", async () => {
    const vcr = new CognitiveVCR(TEST_CASSETTE, "record");

    const interaction: Interaction = {
      id: "1",
      timestamp: Date.now(),
      input: { messages: [{ role: "user", content: "hello" }] },
      output: { text: "hi there" },
    };

    vcr.record(interaction);
    await vcr.save();

    const content = await fs.readFile(cassettePath, "utf8");
    expect(content).toContain("hi there");
  });

  it("replays interactions", async () => {
    const vcr = new CognitiveVCR(TEST_CASSETTE, "replay");
    await vcr.load();

    const match = vcr.findMatch({
      messages: [{ role: "user", content: "hello" }],
    });

    expect(match).toBeDefined();
    expect(match?.output.text).toBe("hi there");
  });

  it("returns undefined for mismatch", async () => {
    const vcr = new CognitiveVCR(TEST_CASSETTE, "replay");
    await vcr.load();

    const match = vcr.findMatch({
      messages: [{ role: "user", content: "unknown" }],
    });

    expect(match).toBeUndefined();
  });
});
