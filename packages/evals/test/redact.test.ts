import { describe, expect, test } from "bun:test";

import { redactConfig, snapshotEnv } from "../src/redact.js";

describe("redact", () => {
  test("redactConfig strips authz", () => {
    const out = redactConfig({
      confirmCost: false,
      transport: "acp",
      profiles: "both",
      retain: "never",
      authz: "Bearer abc",
    });

    expect(out.authz).toBe("<redacted>");
  });

  test("snapshotEnv allowlists and redacts", () => {
    const prev = process.env.TEST_SECRET;
    process.env.TEST_SECRET = "sk-" + "a".repeat(40);

    try {
      const out = snapshotEnv(["TEST_SECRET", "MISSING_KEY"]);
      expect(out.TEST_SECRET).toContain("[REDACTED]");
      expect(out.MISSING_KEY).toBeUndefined();
    } finally {
      if (prev === undefined) {
        delete process.env.TEST_SECRET;
      } else {
        process.env.TEST_SECRET = prev;
      }
    }
  });
});
