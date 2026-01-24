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

describe("codeprint", () => {
  let workspace: string;

  beforeAll(async () => {
    workspace = await mkdtemp(join(tmpdir(), "codeprint-test-"));
    await mkdir(join(workspace, "src"));

    await writeFile(
      join(workspace, "src/user.ts"),
      `
      export interface User { id: string; name: string; }
      export function createUser(name: string): User { return { id: "1", name }; }
      export function deleteUser(id: string): void {}
    `
    );

    await writeFile(
      join(workspace, "src/auth.ts"),
      `
      import { User } from "./user.js";
      export function authenticate(user: User): boolean { return true; }
      export function logout(): void {}
    `
    );

    await writeFile(
      join(workspace, "src/api.ts"),
      `
      import { createUser, deleteUser } from "./user.js";
      import { authenticate } from "./auth.js";
      export function handleRequest(req: unknown): void {}
    `
    );

    await rebuildIndex(workspace);
  });

  afterAll(async () => {
    clearIndex(workspace);
    await rm(workspace, { recursive: true });
  });

  test("finds relevant files by keyword", async () => {
    const results = await findRelevantFiles(
      workspace,
      "user authentication",
      5
    );
    expect(results.length).toBeGreaterThan(0);
    const paths = results.map((r) => r.path);
    expect(paths).toContain("src/user.ts");
    expect(paths).toContain("src/auth.ts");
  });

  test("returns empty for no matches", async () => {
    const results = await findRelevantFiles(workspace, "zzzznotfound xyz", 5);
    expect(results).toEqual([]);
  });

  test("respects topK limit", async () => {
    const results = await findRelevantFiles(workspace, "user", 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  test("handles parse errors gracefully", async () => {
    await writeFile(join(workspace, "src/broken.ts"), "export const x = {{{");
    await rebuildIndex(workspace);

    const results = await findRelevantFiles(workspace, "user", 5);
    expect(results.length).toBeGreaterThan(0);

    await rm(join(workspace, "src/broken.ts"));
  });

  test("provides index stats", async () => {
    const stats = getIndexStats(workspace);
    expect(stats).not.toBeNull();
    expect(stats!.size).toBeGreaterThanOrEqual(3);
    expect(stats!.cached).toBe(true);
    expect(stats!.age).toBeGreaterThanOrEqual(0);
  });

  test("clearIndex removes cached data", () => {
    clearIndex(workspace);
    const stats = getIndexStats(workspace);
    expect(stats).toBeNull();
  });

  test("scores files by keyword match count", async () => {
    await rebuildIndex(workspace);
    const results = await findRelevantFiles(workspace, "create user delete", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.path).toBe("src/user.ts");
  });
});
