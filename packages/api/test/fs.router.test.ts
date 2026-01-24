import { afterAll, describe, expect, it } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { createTestCaller } from "./utils/trpc";

function relFromRoot(absPath: string): string {
  return path.relative(process.cwd(), absPath);
}

describe("fs router (security boundaries)", () => {
  const root = process.cwd();
  const tmpRoot = mkdtempSync(path.join(root, ".tmp-fsrouter-"));

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("reads + writes files within the project root", async () => {
    const caller = await createTestCaller();
    const filePath = path.join(tmpRoot, "hello.txt");
    const rel = relFromRoot(filePath);

    await caller.fs.write({ path: rel, content: "hello" });
    const result = await caller.fs.read({ path: rel });
    expect(result).toEqual({ content: "hello" });
  });

  it("rejects path traversal outside the project root", async () => {
    const caller = await createTestCaller();
    await expect(
      caller.fs.read({ path: "../etc/hosts" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      caller.fs.write({ path: "../etc/pwned", content: "nope" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects absolute paths", async () => {
    const caller = await createTestCaller();
    await expect(caller.fs.read({ path: "/etc/hosts" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("returns BAD_REQUEST when reading a directory", async () => {
    const caller = await createTestCaller();
    const dirPath = path.join(tmpRoot, "dir");
    mkdirSync(dirPath);

    await expect(
      caller.fs.read({ path: relFromRoot(dirPath) })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects symlinks that escape the project root on read", async () => {
    const caller = await createTestCaller();
    const linkPath = path.join(tmpRoot, "hosts-link");
    symlinkSync("/etc/hosts", linkPath);

    await expect(
      caller.fs.read({ path: relFromRoot(linkPath) })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects writes through a symlinked directory that escapes the project root", async () => {
    const caller = await createTestCaller();
    const linkDir = path.join(tmpRoot, "out");
    symlinkSync("/tmp", linkDir, "dir");

    await expect(
      caller.fs.write({
        path: relFromRoot(path.join(linkDir, "pwned.txt")),
        content: "nope",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects writes through broken symlinks pointing outside project root", async () => {
    const caller = await createTestCaller();
    const brokenLinkPath = path.join(tmpRoot, "broken-link");
    // Create a broken symlink pointing to a non-existent path outside project root
    symlinkSync("/nonexistent/outside/path", brokenLinkPath);

    await expect(
      caller.fs.write({
        path: relFromRoot(brokenLinkPath),
        content: "should be rejected",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("symlink"),
    });
  });

  it("still allows regular (non-symlink) files inside root", async () => {
    const caller = await createTestCaller();
    const filePath = path.join(tmpRoot, "plain.txt");
    writeFileSync(filePath, "plain", "utf-8");
    const result = await caller.fs.read({ path: relFromRoot(filePath) });
    expect(result).toEqual({ content: "plain" });
  });
});
