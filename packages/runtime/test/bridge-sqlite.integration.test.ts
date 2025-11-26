/**
 * RuntimeKnowledgeBridge ↔ @alfred/db sqlite integration
 *
 * This test exercises RuntimeKnowledgeBridge directly against the real
 * graph persistence layer using the sqlite test driver. It complements
 * the LearningEngine → bridge stubbed test, which only verifies that
 * persistHypergraphToDb is invoked with the right resource.
 *
 * To run this test with actual sqlite persistence, ensure
 *   DATABASE_URL=sqlite::memory:
 * before invoking bun test so @alfred/db initialises the sqlite driver.
 */

import { beforeAll, describe, expect, it } from "bun:test";
import type {
  KnowledgeConfidence,
  KnowledgeFact,
  KnowledgeUpdate,
} from "@alfred/type/knowledge";
import { eq } from "drizzle-orm";

type BridgeModule = typeof import("../src/engines/bridge");
type DbModule = typeof import("@alfred/db");
type GraphSchemaModule = typeof import("@alfred/db/schema/graph");

const RUN_DB_TESTS = process.env.RUN_RUNTIME_DB_TESTS === "1";
const describeDb = RUN_DB_TESTS ? describe : describe.skip;

describeDb("RuntimeKnowledgeBridge sqlite integration", () => {
  let RuntimeKnowledgeBridge: BridgeModule["RuntimeKnowledgeBridge"] | null =
    null;
  let db: DbModule["db"] | null = null;
  let memoryNodes: GraphSchemaModule["memoryNodes"] | null = null;
  let isSqliteDriver: DbModule["isSqliteDriver"] | null = null;

  beforeAll(async () => {
    // Prefer sqlite for this test; when DATABASE_URL is unset, callers
    // should set DATABASE_URL=sqlite::memory: before running bun test
    // so that @alfred/db initialises the sqlite test driver and
    // persistKnowledge does not early-return.
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = "sqlite::memory:";
    }

    const [bridgeMod, dbMod, graphMod] = await Promise.all([
      import("../src/engines/bridge") as Promise<BridgeModule>,
      import("@alfred/db") as Promise<DbModule>,
      import("@alfred/db/schema/graph") as Promise<GraphSchemaModule>,
    ]);

    RuntimeKnowledgeBridge = bridgeMod.RuntimeKnowledgeBridge;
    db = dbMod.db;
    isSqliteDriver = dbMod.isSqliteDriver;
    memoryNodes = graphMod.memoryNodes;
  });

  it("persists fact nodes into memory_nodes for runtime: resources", async () => {
    if (!(RuntimeKnowledgeBridge && db && memoryNodes && isSqliteDriver)) {
      throw new Error("sqlite bridge test not initialised correctly");
    }

    if (!isSqliteDriver()) {
      // Environment is not using sqlite; treat as a soft skip so the
      // suite remains green under Postgres-only runs.
      // eslint-disable-next-line no-console
      console.warn(
        "Skipping RuntimeKnowledgeBridge sqlite integration test (db driver is not sqlite)"
      );
      expect(true).toBe(true);
      return;
    }

    const runId = `runtime-bridge-sqlite-${Date.now()}`;
    const resource = `runtime:${runId}`;
    const bridge = new RuntimeKnowledgeBridge({
      resource,
      runId,
    });

    const fact: KnowledgeFact = {
      id: `fact-${runId}`,
      content: "Runtime bridge sqlite integration fact",
      confidence: 0.9 as KnowledgeConfidence,
      source: "test:runtime-bridge-sqlite",
      timestamp: new Date().toISOString(),
      tags: ["runtime", "sqlite"],
    };

    const updates: KnowledgeUpdate[] = [
      {
        node: fact,
      },
    ];

    bridge.applyUpdates(updates);
    await bridge.persist();

    const rows = await db
      .select()
      .from(memoryNodes)
      .where(eq(memoryNodes.resource, resource));

    expect(rows.length).toBeGreaterThan(0);

    const labels = rows.map((row) => row.label);
    expect(
      labels.some((label) =>
        label.includes("Runtime bridge sqlite integration fact")
      )
    ).toBe(true);
  }, 20_000);
});
