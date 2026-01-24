import { afterAll, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { exportAgentfsRunToCas } from "../src/agentfscas";

describe("agentfs cas", () => {
  const rootAbs = path.resolve(process.cwd(), ".agentfs-test");

  afterAll(async () => {
    await rm(rootAbs, { force: true, recursive: true });
  });

  it("stores deterministic content-addressed archives", async () => {
    await rm(rootAbs, { force: true, recursive: true });

    const runId = "run-cas";
    const runDirRel = path.posix.join(".agentfs-test", runId);
    const runDirAbs = path.resolve(process.cwd(), runDirRel);
    await mkdir(runDirAbs, { recursive: true });
    await writeFile(path.join(runDirAbs, "agentfs.db"), "db", "utf8");

    const a = await exportAgentfsRunToCas({
      relDir: runDirRel,
      rootAbs,
      runId,
    });

    const b = await exportAgentfsRunToCas({
      relDir: runDirRel,
      rootAbs,
      runId,
    });

    expect(a.sha).toBe(b.sha);
    expect(existsSync(a.absPath)).toBe(true);

    const casEntries = await readdir(path.join(rootAbs, "cas"));
    expect(casEntries.filter((e) => e.endsWith(".tar.gz")).length).toBe(1);
  });
});
