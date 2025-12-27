import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Mock AI tools to ensure fallbackScan is used by gatherCodeContext
mock.module("@alfred/agent/orchestrator/tool/codex", () => ({
  toolCodex: { execute: async () => ({ result: "" }) },
}));
mock.module("@alfred/agent/orchestrator/tool/droid", () => ({
  toolDroid: { execute: async () => ({ result: "" }) },
}));

// Import the real function
import { gatherInternalResearch } from "../research/internal.js";

describe("Internal Research Integration", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = join(tmpdir(), `alfred-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    // Create some dummy files to find
    await writeFile(join(tempDir, "auth.ts"), "export const login = () => {}");
    await writeFile(
      join(tempDir, "user.ts"),
      "export const getUser = () => {}"
    );
    await mkdir(join(tempDir, "styles"), { recursive: true });
    await writeFile(
      join(tempDir, "styles", "theme.ts"),
      "export const theme = {}"
    );
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should find real files in a temporary directory via fallbackScan", async () => {
    const mockIntent = {
      id: "test-id",
      description: "Find auth and user logic",
      userId: "user-123",
      source: "chat" as const,
      timestamp: new Date(),
      context: {
        workspace: tempDir,
        existingPatterns: [],
        constraints: [],
      },
    };

    const result = await gatherInternalResearch(mockIntent);

    expect(result.existingCode.length).toBeGreaterThan(0);
    const filePaths = result.existingCode;
    expect(filePaths.some((p) => p.includes("auth.ts"))).toBe(true);
    expect(filePaths.some((p) => p.includes("user.ts"))).toBe(true);
  });
});
