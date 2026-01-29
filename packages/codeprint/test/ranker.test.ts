import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { findRelevantFiles, rebuildIndex, clearIndex } from "../src/index.js";

describe("codeprint ranker", () => {
  let workspace: string;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    process.env = { ...originalEnv, CODEPRINT_RANKER: "1" };

    workspace = await mkdtemp(join(tmpdir(), "codeprint-ranker-"));
    await mkdir(join(workspace, "src"));

    await writeFile(
      join(workspace, "src/user.ts"),
      `
      export interface User { id: string; name: string; }
      export function createUser(name: string): User { return { id: "1", name }; }
    `
    );

    await writeFile(
      join(workspace, "src/types.ts"),
      `
      export type UserId = string;
    `
    );

    await rebuildIndex(workspace);
  });

  afterAll(async () => {
    process.env = { ...originalEnv };
    clearIndex(workspace);
    await rm(workspace, { recursive: true });
  });

  test("is deterministic for the same query", async () => {
    const q = "user types";
    const r1 = await findRelevantFiles(workspace, q, 5);
    const r2 = await findRelevantFiles(workspace, q, 5);
    expect(r1.map((r) => r.path)).toEqual(r2.map((r) => r.path));
  });
});
