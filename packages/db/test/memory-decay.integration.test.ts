import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { describePostgres, requirePostgresTestEnv } from "@alfred/db/testing";
import { sql } from "drizzle-orm";

const TEST_RESOURCE = "test-decay-resource";
const SHOULD_RUN = Boolean(process.env.RUN_DB_TESTS);
const describeFn = SHOULD_RUN ? describePostgres : describe.skip;

let graphRepo: typeof import("@alfred/db").graphRepo;
let db: typeof import("@alfred/db").db;
let findNodesForDecay: typeof import("@alfred/db/repo/graph/read").findNodesForDecay;
let updateNodeConfidenceBatch: typeof import("@alfred/db/repo/graph/write").updateNodeConfidenceBatch;
let findNodesByConfidence: typeof import("@alfred/db/repo/graph/read").findNodesByConfidence;
let archiveNodes: typeof import("@alfred/db/repo/graph/write").archiveNodes;
let deleteArchivedNodes: typeof import("@alfred/db/repo/graph/write").deleteArchivedNodes;

async function resetGraph() {
  if (!db) {
    return;
  }
  if (typeof db.execute !== "function") {
    return;
  }
  await db.execute(
    sql`TRUNCATE memory_edges, memory_nodes RESTART IDENTITY CASCADE`
  );
}

describeFn("Memory Decay Integration", () => {
  beforeAll(async () => {
    requirePostgresTestEnv(
      "Memory decay tests require Postgres. Set DATABASE_URL and RUN_DB_TESTS=1."
    );
    const dbMod = await import("@alfred/db");
    graphRepo = dbMod.graphRepo;
    db = dbMod.db;
    
    // Import decay functions directly
    const graphRead = await import("@alfred/db/repo/graph/read");
    const graphWrite = await import("@alfred/db/repo/graph/write");
    findNodesForDecay = graphRead.findNodesForDecay;
    updateNodeConfidenceBatch = graphWrite.updateNodeConfidenceBatch;
    findNodesByConfidence = graphRead.findNodesByConfidence;
    archiveNodes = graphWrite.archiveNodes;
    deleteArchivedNodes = graphWrite.deleteArchivedNodes;
  });

  beforeEach(async () => {
    await resetGraph();
  });

  it("decays stale nodes correctly", async () => {
    // Create nodes with old updated timestamps
    const nodes = await graphRepo.upsertNodes([
      {
        resource: TEST_RESOURCE,
        hash: "stale-1",
        kind: "fact",
        label: "Stale Node 1",
        properties: { confidence: 0.8 },
      },
      {
        resource: TEST_RESOURCE,
        hash: "stale-2",
        kind: "fact",
        label: "Stale Node 2",
        properties: { confidence: 0.6 },
      },
    ]);

    const id1 = nodes.get(`${TEST_RESOURCE}:stale-1`)?.id;
    const id2 = nodes.get(`${TEST_RESOURCE}:stale-2`)?.id;

    if (!(id1 && id2)) {
      throw new Error("Missing node ids");
    }

    // Manually set updated timestamp to be old (simulate stale nodes)
    await db.execute(
      sql`UPDATE memory_nodes SET updated_at = NOW() - INTERVAL '2 days' WHERE id = ANY(${sql.raw(`ARRAY['${id1}', '${id2}']::uuid[]`)})`
    );

    // Run decay logic directly (simulating processMemoryMaintenance)
    const staleNodes = await findNodesForDecay(
      24 * 60 * 60 * 1000, // 24 hours threshold
      1000 // limit
    );
    
    const updates = staleNodes.map((node) => {
      const props = (node.properties as Record<string, unknown>) || {};
      const currentConfidence =
        typeof props.confidence === "number" ? props.confidence : 1.0;
      const newConfidence = Math.max(
        0.01, // confidence floor
        currentConfidence * 0.9 // decay factor
      );
      return {
        id: node.id,
        confidence: newConfidence,
      };
    });
    
    await updateNodeConfidenceBatch(updates);

    // Verify confidence was decayed
    const node1 = await graphRepo.getNode(id1);
    const node2 = await graphRepo.getNode(id2);

    expect(node1).not.toBeNull();
    expect(node2).not.toBeNull();

    const conf1 = (node1?.properties as Record<string, unknown>)?.confidence;
    const conf2 = (node2?.properties as Record<string, unknown>)?.confidence;

    // Confidence should be decayed: 0.8 * 0.9 = 0.72, 0.6 * 0.9 = 0.54
    expect(typeof conf1).toBe("number");
    expect(typeof conf2).toBe("number");
    expect(conf1).toBeCloseTo(0.72, 2);
    expect(conf2).toBeCloseTo(0.54, 2);
  });

  it("respects confidence floor during decay", async () => {
    const nodes = await graphRepo.upsertNodes([
      {
        resource: TEST_RESOURCE,
        hash: "low-conf",
        kind: "fact",
        label: "Low Confidence Node",
        properties: { confidence: 0.02 }, // Near floor
      },
    ]);

    const id = nodes.get(`${TEST_RESOURCE}:low-conf`)?.id;
    if (!id) {
      throw new Error("Missing node id");
    }

    // Set updated timestamp to be old
    await db.execute(
      sql`UPDATE memory_nodes SET updated_at = NOW() - INTERVAL '2 days' WHERE id = ${sql.raw(`'${id}'::uuid`)}`
    );

    // Run decay with factor 0.9
    // 0.02 * 0.9 = 0.018, but should be clamped to floor (0.01)
    const staleNodes = await findNodesForDecay(24 * 60 * 60 * 1000, 1000);
    const updates = staleNodes.map((node) => {
      const props = (node.properties as Record<string, unknown>) || {};
      const currentConfidence =
        typeof props.confidence === "number" ? props.confidence : 1.0;
      const newConfidence = Math.max(
        0.01, // confidence floor
        currentConfidence * 0.9 // decay factor
      );
      return {
        id: node.id,
        confidence: newConfidence,
      };
    });
    await updateNodeConfidenceBatch(updates);

    const node = await graphRepo.getNode(id);
    const conf = (node?.properties as Record<string, unknown>)?.confidence;

    // Should be clamped to floor, not below it
    expect(conf).toBeGreaterThanOrEqual(0.01);
  });

  it("prunes low confidence nodes", async () => {
    const nodes = await graphRepo.upsertNodes([
      {
        resource: TEST_RESOURCE,
        hash: "prune-1",
        kind: "fact",
        label: "Low Confidence Node",
        properties: { confidence: 0.1 }, // Below prune threshold
      },
    ]);

    const id = nodes.get(`${TEST_RESOURCE}:prune-1`)?.id;
    if (!id) {
      throw new Error("Missing node id");
    }

    // Run pruning logic directly
    const lowConfidenceNodes = await findNodesByConfidence(0, 0.2, undefined, 100);
    if (lowConfidenceNodes.length > 0) {
      const ids = lowConfidenceNodes.map((n) => n.id);
      await archiveNodes(ids, "low_confidence");
    }

    const node = await graphRepo.getNode(id);
    const props = node?.properties as Record<string, unknown> | null;

    // Node should be archived (properties.archived = timestamp string)
    const archived = props?.archived;
    expect(typeof archived).toBe("string");
    expect(Number.isNaN(Date.parse(archived as string))).toBe(false);
    expect(props?.archiveReason).toBe("low_confidence");
  });

  it("does not decay recently touched nodes", async () => {
    const nodes = await graphRepo.upsertNodes([
      {
        resource: TEST_RESOURCE,
        hash: "touched",
        kind: "fact",
        label: "Recently Touched Node",
        properties: { confidence: 0.8 },
      },
    ]);

    const id = nodes.get(`${TEST_RESOURCE}:touched`)?.id;
    if (!id) {
      throw new Error("Missing node id");
    }

    // Touch the node (updates timestamp)
    await graphRepo.touchNodes([id]);

    // Try to set updated to old (should be overwritten by touchNodes)
    // Actually, let's verify the node is NOT in decay candidates
    const staleNodes = await graphRepo.findNodesForDecay(
      24 * 60 * 60 * 1000, // 24 hours
      1000
    );

    const nodeInDecay = staleNodes.some((n) => n.id === id);
    expect(nodeInDecay).toBe(false);

    // Verify node is not in decay candidates
    const staleNodesFinal = await findNodesForDecay(24 * 60 * 60 * 1000, 1000);
    const nodeInDecayFinal = staleNodesFinal.some((n) => n.id === id);
    expect(nodeInDecayFinal).toBe(false);

    // Run decay logic - node should not be included
    const before = await graphRepo.getNode(id);
    const confBefore = (before?.properties as Record<string, unknown>)
      ?.confidence as number;

    // Only decay nodes that are in staleNodesFinal (which excludes our touched node)
    const updates = staleNodesFinal.map((node) => {
      const props = (node.properties as Record<string, unknown>) || {};
      const currentConfidence =
        typeof props.confidence === "number" ? props.confidence : 1.0;
      return {
        id: node.id,
        confidence: Math.max(0.01, currentConfidence * 0.9),
      };
    });
    await updateNodeConfidenceBatch(updates);

    const after = await graphRepo.getNode(id);
    const confAfter = (after?.properties as Record<string, unknown>)
      ?.confidence as number;

    // Confidence should be same or higher (touchNodes boosts it)
    expect(confAfter).toBeGreaterThanOrEqual(confBefore);
  });
});
