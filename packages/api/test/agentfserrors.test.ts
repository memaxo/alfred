import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const repoCwd = process.cwd();
const rootAbs = path.resolve(
  repoCwd,
  ".agent",
  "test-workspaces",
  "agentfs-errors"
);
const agentfsDir = path.join(rootAbs, ".agentfs");
const casDir = path.join(agentfsDir, "cas");
const quarantineDir = path.join(agentfsDir, "quarantine");

describe("agentfs cas/quarantine router error mapping", () => {
  afterAll(async () => {
    try {
      process.chdir(repoCwd);
    } catch {
      // ignore
    }
    await rm(rootAbs, { force: true, recursive: true });
  });

  beforeEach(async () => {
    await rm(rootAbs, { force: true, recursive: true });
    await mkdir(casDir, { recursive: true });
    await mkdir(quarantineDir, { recursive: true });
    process.chdir(rootAbs);
  });

  it("maps casDelete not_found → NOT_FOUND", async () => {
    const { createTestCaller } = await import("./utils/trpc");
    const caller = await createTestCaller({
      scopes: ["read:agentfs", "write:agentfs"],
    });
    await expect(
      caller.agentfs.casDelete({ sha: "a".repeat(64) })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("maps casDelete pinned → PRECONDITION_FAILED", async () => {
    const sha = "b".repeat(64);
    await writeFile(path.join(casDir, `${sha}.json`), "{}", "utf8");
    await writeFile(path.join(casDir, `${sha}.keep`), "", "utf8");

    const { createTestCaller } = await import("./utils/trpc");
    const caller = await createTestCaller({
      scopes: ["read:agentfs", "write:agentfs"],
    });
    await expect(caller.agentfs.casDelete({ sha })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  it("maps quarantineRestore not_found → NOT_FOUND", async () => {
    const { createTestCaller } = await import("./utils/trpc");
    const caller = await createTestCaller({
      scopes: ["read:agentfs", "write:agentfs"],
    });
    await expect(
      caller.agentfs.quarantineRestore({ id: "missing" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("maps quarantineRestore pinned → PRECONDITION_FAILED", async () => {
    const id = "run-1";
    const itemDir = path.join(quarantineDir, `${id}-2026-01-01T00-00-00-000Z`);
    await mkdir(itemDir, { recursive: true });
    await writeFile(path.join(itemDir, ".keep"), "pinned", "utf8");
    await writeFile(
      path.join(itemDir, "quarantine.json"),
      JSON.stringify(
        { at: new Date().toISOString(), reason: "manual", runId: id },
        null,
        2
      ),
      "utf8"
    );

    const { createTestCaller } = await import("./utils/trpc");
    const caller = await createTestCaller({
      scopes: ["read:agentfs", "write:agentfs"],
    });
    await expect(
      caller.agentfs.quarantineRestore({ id })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });
});
