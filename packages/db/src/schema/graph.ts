/**
 * ALFRED Graph Memory Schema
 * Orchestrator knowledge graph for tracking relationships
 */

import { pgTable, text, timestamp, uuid, jsonb, real } from "drizzle-orm/pg-core";

// TODO: [Phase 4] Add proper indexes for graph traversal performance

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
});

// TODO: [Phase 4] Add index on kind for filtering by node type
// TODO: [Phase 4] Add index on label for search

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

// TODO: [Phase 4] Add index on (fromId, kind) for outbound edge queries
// TODO: [Phase 4] Add index on (toId, kind) for inbound edge queries
// TODO: [Phase 4] Add index on kind for filtering by edge type

// TODO: [Phase 4] Add graph traversal helpers in repo layer
// - getNeighbors(nodeId, direction, kind)
// - findPath(fromId, toId, maxDepth)
// - getSubgraph(nodeIds)
