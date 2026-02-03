import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { listCasArchives } from "../src/services/agentfs-cas";

describe("agentfs cas list", () => {
  const rootAbs = path.resolve(
    process.cwd(),
    ".agent",
    "test-workspaces",
    "agentfs-caslist"
  );
  const casDir = path.join(rootAbs, "cas");

  afterAll(async () => {
    await rm(rootAbs, { force: true, recursive: true });
  });

  beforeEach(async () => {
    await rm(rootAbs, { force: true, recursive: true });
    await mkdir(casDir, { recursive: true });
  });

  async function writeCasMeta(args: {
    sha: string;
    runId: string;
    createdAt: Date;
    projectId?: string | null;
    sizeBytes?: number;
    pinned?: boolean;
  }): Promise<void> {
    await writeFile(
      path.join(casDir, `${args.sha}.json`),
      JSON.stringify(
        {
          sha: args.sha,
          runId: args.runId,
          projectId: args.projectId ?? null,
          createdAt: args.createdAt.toISOString(),
          sizeBytes: args.sizeBytes ?? 1,
        },
        null,
        2
      ),
      "utf8"
    );
    if (args.pinned) {
      await writeFile(path.join(casDir, `${args.sha}.keep`), "", "utf8");
    }
  }

  it("supports cursor-based pagination and runId filter", async () => {
    const t1 = new Date("2026-01-03T00:00:00.000Z");
    const t2 = new Date("2026-01-02T00:00:00.000Z");
    const t3 = new Date("2026-01-01T00:00:00.000Z");

    const sha1 = "a".repeat(64);
    const sha2 = "b".repeat(64);
    const sha3 = "c".repeat(64);

    await writeCasMeta({ sha: sha1, runId: "run-a", createdAt: t1 });
    await writeCasMeta({ sha: sha2, runId: "run-a", createdAt: t2 });
    await writeCasMeta({ sha: sha3, runId: "run-b", createdAt: t3 });

    const page1 = await listCasArchives({ rootAbs, limit: 2 });
    expect(page1.archives.map((a) => a.sha)).toEqual([sha1, sha2]);
    expect(page1.nextCursor).toBeDefined();

    const page2 = await listCasArchives({
      rootAbs,
      limit: 2,
      cursor: page1.nextCursor,
    });
    expect(page2.archives.map((a) => a.sha)).toEqual([sha3]);
    expect(page2.nextCursor).toBeUndefined();

    const runA = await listCasArchives({ rootAbs, runId: "run-a", limit: 10 });
    expect(runA.archives.map((a) => a.sha)).toEqual([sha1, sha2]);
    expect(runA.archives.every((a) => a.runId === "run-a")).toBe(true);
  });
});
