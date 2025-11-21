#!/usr/bin/env bun

import { memoryEdges, memoryNodes } from "@alfred/db/schema/graph";
import { empty, fact, relation } from "@alfred/knowledge/hypergraph";
import { semanticQuery } from "@alfred/knowledge/query";
import { eq } from "drizzle-orm";

type HypergraphBridgeModule =
  typeof import("@alfred/agent/assistant/hypergraph-bridge");
let persistHypergraphToDb: HypergraphBridgeModule["persistHypergraphToDb"];
let loadHypergraphFromDb: HypergraphBridgeModule["loadHypergraphFromDb"];
let db: typeof import("@alfred/db")["db"];

async function cleanup(resource: string) {
  await db
    .delete(memoryEdges)
    .where(eq(memoryEdges.resource, resource))
    .execute()
    .catch(() => {});
  await db
    .delete(memoryNodes)
    .where(eq(memoryNodes.resource, resource))
    .execute()
    .catch(() => {});
}

async function run() {
  const args = new Set(process.argv.slice(2));
  if (!args.has("--use-existing-db")) {
    process.env.DATABASE_URL = "sqlite::memory:";
  }
  ({ persistHypergraphToDb, loadHypergraphFromDb } = await import(
    "@alfred/agent/assistant/hypergraph-bridge"
  ));
  ({ db } = await import("@alfred/db"));
  const resource = `smoke-${Date.now()}`;
  const graph = empty();
  const alpha = graph.add(fact("Alpha smoke scenario", 0.9, "smoke"));
  const beta = graph.add(fact("Beta dependency", 0.8, "smoke"));
  graph.add(relation(alpha, beta, "relates_to"));

  await persistHypergraphToDb(graph, resource);

  const restored = empty();
  await loadHypergraphFromDb(resource, restored);

  const results = semanticQuery("alpha", restored, 5);
  if (!results.includes(alpha)) {
    throw new Error(
      `Smoke query failed; expected Alpha in results: ${results}`
    );
  }

  console.log(
    JSON.stringify(
      {
        event: "smoke.hypergraph",
        resource,
        nodes: restored.size(),
        results: results.length,
      },
      null,
      2
    )
  );

  await cleanup(resource);
}

run().catch(async (error) => {
  console.error("[smoke.hypergraph] failure", error);
  process.exitCode = 1;
});
