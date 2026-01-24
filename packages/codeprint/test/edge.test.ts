import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  findRelevantFiles,
  rebuildIndex,
  clearIndex,
  getIndexStats,
} from "../src/index.js";

describe("edge cases", () => {
  let workspace: string;

  beforeAll(async () => {
    workspace = await mkdtemp(join(tmpdir(), "codeprint-edge-"));
    await mkdir(join(workspace, "src"));
  });

  afterAll(async () => {
    clearIndex(workspace);
    await rm(workspace, { recursive: true });
  });

  test("empty repository returns empty results", async () => {
    await rebuildIndex(workspace);
    const results = await findRelevantFiles(workspace, "test query", 10);
    expect(results).toEqual([]);
  });

  test("single file repository works", async () => {
    await writeFile(
      join(workspace, "src/single.ts"),
      "export function hello(): void {}"
    );
    await rebuildIndex(workspace);

    const results = await findRelevantFiles(workspace, "hello", 10);
    expect(results.length).toBe(1);
    expect(results[0]!.path).toBe("src/single.ts");
  });

  test("handles files with special characters in path", async () => {
    await mkdir(join(workspace, "src/special-chars"));
    await writeFile(
      join(workspace, "src/special-chars/file_with_underscores.ts"),
      "export const x = 1;"
    );
    await rebuildIndex(workspace);

    const stats = getIndexStats(workspace);
    expect(stats).not.toBeNull();
    expect(stats!.size).toBeGreaterThanOrEqual(1);
  });

  test("handles unicode in file content", async () => {
    await writeFile(
      join(workspace, "src/unicode.ts"),
      `export const emoji = "🚀"; export const chinese = "中文";`
    );
    await rebuildIndex(workspace);

    const results = await findRelevantFiles(workspace, "emoji", 10);
    expect(results.length).toBeGreaterThan(0);
  });

  test("handles very long export names", async () => {
    const longName = "veryLongFunctionNameThatExceedsNormalLengthLimits".repeat(
      5
    );
    await writeFile(
      join(workspace, "src/longname.ts"),
      `export function ${longName}(): void {}`
    );
    await rebuildIndex(workspace);

    const stats = getIndexStats(workspace);
    expect(stats!.size).toBeGreaterThanOrEqual(1);
  });

  test("handles files with no exports", async () => {
    await writeFile(
      join(workspace, "src/noexports.ts"),
      `const internal = 42; console.log(internal);`
    );
    await rebuildIndex(workspace);

    // Should still be indexed (path keywords)
    const results = await findRelevantFiles(workspace, "noexports", 10);
    expect(results.length).toBe(1);
  });

  test("handles empty query", async () => {
    const results = await findRelevantFiles(workspace, "", 10);
    expect(results).toEqual([]);
  });

  test("handles query with only stopwords", async () => {
    const results = await findRelevantFiles(workspace, "a the is", 10);
    expect(results).toEqual([]);
  });

  test("handles camelCase identifiers", async () => {
    await writeFile(
      join(workspace, "src/userService.ts"),
      "export function getUserById(): void {}"
    );
    await rebuildIndex(workspace);

    // Should match on "user" and "service" from path, "get" and "user" from export
    const results = await findRelevantFiles(workspace, "user service get", 10);
    expect(results.length).toBeGreaterThan(0);
  });

  test("topK=0 returns empty", async () => {
    const results = await findRelevantFiles(workspace, "test", 0);
    expect(results).toEqual([]);
  });

  test("topK=1 returns at most 1", async () => {
    const results = await findRelevantFiles(workspace, "src", 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });
});
