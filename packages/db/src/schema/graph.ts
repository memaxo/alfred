/**
 * ALFRED Graph Memory Schema
 * Orchestrator knowledge graph for tracking relationships
 */

import { EMBEDDING_DIM } from "@alfred/embed";
import {
  customType,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

// Graph traversal indexes for memory_edges are created in 0035_graph_traversal_indexes.sql

/**
 * Memory nodes (entities in the knowledge graph)
 */
export const memoryNodes = pgTable("memory_nodes", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: text("kind").notNull(), // "requirement" | "ticket" | "system" | "agent" | "vm" | "deployment"
  label: text("label").notNull(), // Human-readable label
  resource: text("resource").notNull(), // Scope identifier (thread/resource)
  hash: text("hash").notNull(), // Content-addressed identifier
  properties: jsonb("properties"), // Arbitrary node properties
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  labelTsvector: tsvector("label_tsvector"),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIM }),
});

// Index coverage:
// - label_tsvector is generated + GIN indexed (0034)

/**
 * Memory edges (relationships between nodes)
 */
export const memoryEdges = pgTable("memory_edges", {
  id: uuid("id").defaultRandom().primaryKey(),
  fromId: uuid("from_id")
    .notNull()
    .references(() => memoryNodes.id, { onDelete: "cascade" }),
  toId: uuid("to_id")
    .notNull()
    .references(() => memoryNodes.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // "relates_to" | "blocks" | "assigned_to" | "runs_on" | "implements"
  weight: real("weight").default(1.0), // Edge weight for importance/strength
  metadata: jsonb("metadata"), // Arbitrary edge properties
  resource: text("resource").notNull(), // Scope identifier
  hash: text("hash").notNull(), // Unique edge identifier
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Index coverage:
// - (from_id, kind) and (to_id, kind) btree indexes (0035)
// - (from_id, kind, resource) and (to_id, kind, resource) compound indexes (0035)
// - kind-only index for type filtering (0035)

// TODO: [Phase 4] Add graph traversal helpers in repo layer
// - getNeighbors(nodeId, direction, kind)
// - findPath(fromId, toId, maxDepth)
// - getSubgraph(nodeIds)
