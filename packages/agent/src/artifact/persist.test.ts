import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, readFile, rm, symlink } from "node:fs/promises";
import path from "node:path";

import { persistArtifact } from "./persist.js";

const rootBase = path.join(
  process.cwd(),
  ".agent",
  "test-workspaces",
  `persist-artifact-${Date.now()}`
);

async function resetDir() {
  await rm(rootBase, { force: true, recursive: true });
  await mkdir(rootBase, { recursive: true });
}

afterAll(async () => {
  await rm(rootBase, { force: true, recursive: true });
});

describe("persistArtifact", () => {
  it("writes under .agent/tools/<category>", async () => {
    await resetDir();

    const res = await persistArtifact({
      category: "codex",
      content: '{\n  "ok": true\n}',
      format: "json",
      repoRoot: rootBase,
      tool: "codex",
    });

    expect(res.path).toBe(".agent/tools/codex/codex.json");

    const full = path.join(rootBase, res.path);
    const content = await readFile(full, "utf8");
    expect(content).toContain('"ok": true');
  });

  it("refuses writing through a symlink", async () => {
    await resetDir();

    const outside = path.join(rootBase, "outside");
    await mkdir(outside, { recursive: true });
    await symlink(outside, path.join(rootBase, ".agent"));

    await expect(
      persistArtifact({
        category: "codex",
        content: "{}",
        format: "json",
        repoRoot: rootBase,
        tool: "codex",
      })
    ).rejects.toThrow("artifact_symlink_refused");
  });
});
