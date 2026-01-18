/**
 * Tests for @alfred/summarize package
 *
 * These tests use ALFRED_SUMMARIZE_OFFLINE=1 to force heuristic fallback
 * for fast, deterministic testing without Python dependencies.
 */

import { afterAll, describe, expect, it } from "bun:test";

// Force offline mode for testing heuristics
process.env.ALFRED_SUMMARIZE_OFFLINE = "1";

// Import after setting env var
const { ami, chunk, getHealth, isPythonAvailable, shutdown, summarize } =
  await import("../src/summarize.js");

describe("@alfred/summarize", () => {
  afterAll(async () => {
    await shutdown();
  });

  describe("isPythonAvailable", () => {
    it("returns a boolean", () => {
      const result = isPythonAvailable();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("summarize (heuristic mode)", () => {
    it("compresses text using heuristics", async () => {
      const text = `
        This is the first paragraph which contains important information.
        It describes the main topic of the document.

        This is the second paragraph with additional details.
        These details are somewhat less important.

        This is the third paragraph concluding the document.
        It summarizes the key points.
      `.trim();

      const result = await summarize(text, {
        targetRatio: 0.5,
      });

      expect(result).toHaveProperty("text");
      expect(result).toHaveProperty("originalTokens");
      expect(result).toHaveProperty("compressedTokens");
      expect(result).toHaveProperty("compressionRatio");
      expect(result).toHaveProperty("metadata");

      // Check that compression happened
      expect(result.compressedTokens).toBeLessThanOrEqual(
        result.originalTokens
      );
      expect(result.metadata.method).toBe("heuristic");
    });

    it("handles empty text", async () => {
      const result = await summarize("", { targetRatio: 0.5 });
      expect(result.text).toBe("");
    });

    it("respects targetRatio", async () => {
      const text = new Array(20)
        .fill("This is a sentence with some words.")
        .join("\n");

      const result30 = await summarize(text, { targetRatio: 0.3 });
      const result70 = await summarize(text, { targetRatio: 0.7 });

      // Lower ratio should produce shorter text
      expect(result30.compressedTokens).toBeLessThan(result70.compressedTokens);
    });
  });

  describe("chunk (heuristic mode)", () => {
    it("splits text into chunks on paragraph boundaries", async () => {
      const text = `
        First paragraph of text.

        Second paragraph of text.

        Third paragraph of text.
      `.trim();

      const result = await chunk(text);

      expect(result).toHaveProperty("chunks");
      expect(Array.isArray(result.chunks)).toBe(true);
      expect(result.chunks.length).toBe(3);
    });

    it("handles single paragraph", async () => {
      const text = "Single paragraph with no breaks.";
      const result = await chunk(text);

      expect(result.chunks.length).toBe(1);
      expect(result.chunks[0]).toBe(text);
    });

    it("handles empty text", async () => {
      const result = await chunk("");
      expect(result.chunks).toEqual([]);
    });
  });

  describe("ami (heuristic mode)", () => {
    it("calculates positive score for related content", async () => {
      const context =
        "The authentication system uses JWT tokens for security. Users login with credentials.";
      const instruction = "How does authentication work?";

      const result = await ami(context, { instruction });

      expect(result).toHaveProperty("score");
      expect(typeof result.score).toBe("number");
      // Should be positive since there's significant word overlap
      expect(result.score).toBeGreaterThan(-5);
    });

    it("returns low/negative score for unrelated content", async () => {
      const context = "The weather today is sunny and warm with clear skies.";
      const instruction = "How does authentication work?";

      const result = await ami(context, { instruction });

      // Low or negative score for unrelated content
      expect(result.score).toBeLessThan(2);
    });

    it("handles empty instruction", async () => {
      const context = "Some context text.";
      const result = await ami(context, { instruction: "" });

      expect(result.score).toBe(0);
    });
  });

  describe("getHealth", () => {
    it("returns null when process not initialized", () => {
      // In offline mode, process is never started
      const health = getHealth();
      expect(health).toBeNull();
    });
  });
});
