import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { listQuarantine } from "../src/services/agentfs-quarantine";

describe("agentfs quarantine", () => {
  const rootAbs = path.resolve(
    process.cwd(),
    ".agent",
    "test-workspaces",
    "agentfs-quarantine"
  );
  const quarantineDir = path.join(rootAbs, ".agentfs", "quarantine");

  afterAll(async () => {
    await rm(rootAbs, { force: true, recursive: true });
  });

  beforeEach(async () => {
    await rm(rootAbs, { force: true, recursive: true });
    await mkdir(quarantineDir, { recursive: true });
  });

  async function writeQuarantineItem(args: {
    dirName: string;
    at: Date;
    type: "run" | "cas";
  }): Promise<void> {
    const itemDir = path.join(quarantineDir, args.dirName);
    await mkdir(itemDir, { recursive: true });

    const meta =
      args.type === "cas"
        ? { at: args.at.toISOString(), reason: "manual", sha: "a".repeat(64) }
        : { at: args.at.toISOString(), reason: "manual", runId: "run-1" };

    await writeFile(
      path.join(itemDir, "quarantine.json"),
      JSON.stringify(meta, null, 2),
      "utf8"
    );
    await writeFile(path.join(itemDir, "payload.txt"), "x", "utf8");
  }

  it("supports cursor-based pagination", async () => {
    await writeQuarantineItem({
      dirName: "item-1",
      at: new Date("2026-01-03T00:00:00.000Z"),
      type: "run",
    });
    await writeQuarantineItem({
      dirName: "item-2",
      at: new Date("2026-01-02T00:00:00.000Z"),
      type: "run",
    });
    await writeQuarantineItem({
      dirName: "item-3",
      at: new Date("2026-01-01T00:00:00.000Z"),
      type: "run",
    });

    const page1 = await listQuarantine({ rootAbs, limit: 2 });
    expect(page1.entries.length).toBe(2);
    expect(page1.nextCursor).toBeDefined();

    const page2 = await listQuarantine({
      rootAbs,
      limit: 2,
      cursor: page1.nextCursor,
    });
    expect(page2.entries.length).toBe(1);
    expect(page2.nextCursor).toBeUndefined();
  });

  it("supports type filter", async () => {
    await writeQuarantineItem({
      dirName: "item-run",
      at: new Date("2026-01-03T00:00:00.000Z"),
      type: "run",
    });
    await writeQuarantineItem({
      dirName: "item-cas",
      at: new Date("2026-01-02T00:00:00.000Z"),
      type: "cas",
    });

    const casOnly = await listQuarantine({ rootAbs, type: "cas", limit: 10 });
    expect(casOnly.entries.length).toBe(1);
    expect(casOnly.entries[0]?.type).toBe("cas");

    const runOnly = await listQuarantine({ rootAbs, type: "run", limit: 10 });
    expect(runOnly.entries.length).toBe(1);
    expect(runOnly.entries[0]?.type).toBe("run");
  });
});
