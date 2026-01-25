import { describePostgres, requirePostgresTestEnv } from "@alfred/db/testing";
import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";

const SHOULD_RUN = process.env.RUN_DB_TESTS === "1";
const describeFn = SHOULD_RUN ? describePostgres : describe.skip;

const TEST_RESOURCE = "test-resource";

let graphRepo: typeof import("@alfred/db").graphRepo;
let db: typeof import("@alfred/db").db;

async function resetTables() {
  if (!db) {
    return;
  }
  await db.execute(
    sql`TRUNCATE knowledge_corrections, memory_edges, memory_nodes RESTART IDENTITY CASCADE`
  );
}

describeFn("graphRepo corrections", () => {
  beforeAll(async () => {
    requirePostgresTestEnv(
      "graphRepo corrections tests require Postgres. Set DATABASE_URL and RUN_DB_TESTS=1."
    );
    const mod = await import("@alfred/db");
    ({ graphRepo } = mod);
    ({ db } = mod);
  });

  beforeEach(async () => {
    await resetTables();
  });

  it("findNodeByHash finds a node scoped by resource", async () => {
    await graphRepo.upsertNodes([
      {
        resource: TEST_RESOURCE,
        hash: "fact-hash",
        kind: "fact",
        label: "A fact",
      },
    ]);

    const found = await graphRepo.findNodeByHash(TEST_RESOURCE, "fact-hash");
    expect(found).not.toBeNull();
    expect(found?.hash).toBe("fact-hash");
    expect(found?.resource).toBe(TEST_RESOURCE);
  });

  it("archives nodes without deleting them", async () => {
    const nodes = await graphRepo.upsertNodes([
      {
        resource: TEST_RESOURCE,
        hash: "to-archive",
        kind: "fact",
        label: "Old fact",
      },
    ]);

    const node = nodes.get(`${TEST_RESOURCE}:to-archive`);
    if (!node) {
      throw new Error("missing_seed_node");
    }

    const archivedCount = await graphRepo.archiveNodes([node.id], "manual");
    expect(archivedCount).toBe(1);

    const fetched = await graphRepo.getNode(node.id);
    expect(fetched).not.toBeNull();

    const props = fetched?.properties as Record<string, unknown> | null;
    expect(props?.archiveReason).toBe("manual");
    expect(typeof props?.archived).toBe("string");
  });

  it("creates and retrieves a knowledge correction record", async () => {
    const nodes = await graphRepo.upsertNodes([
      {
        resource: TEST_RESOURCE,
        hash: "target",
        kind: "fact",
        label: "Incorrect value",
      },
    ]);

    const node = nodes.get(`${TEST_RESOURCE}:target`);
    if (!node) {
      throw new Error("missing_seed_node");
    }

    const created = await graphRepo.createCorrection({
      userId: "test-user",
      resource: TEST_RESOURCE,
      targetType: "node",
      targetId: node.id,
      operation: "update",
      reason: "Fix incorrect value",
      previous: { label: node.label },
      patch: { newValue: "Correct value" },
    });

    expect(created.id).toBeTruthy();

    const fetched = await graphRepo.getCorrection(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.userId).toBe("test-user");
    expect(fetched?.resource).toBe(TEST_RESOURCE);
    expect(fetched?.targetType).toBe("node");
    expect(fetched?.targetId).toBe(node.id);
    expect(fetched?.operation).toBe("update");
  });
});
