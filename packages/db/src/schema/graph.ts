/**
 * ALFRED Graph Memory Schema
 * Orchestrator knowledge graph for tracking relationships
 */

import { EMBEDDING_DIM } from "@alfred/embed";
import {
  boolean,
  customType,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

import { projects } from "./project";

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
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  properties: jsonb("properties"), // Arbitrary node properties
  sanitized: boolean("sanitized").notNull().default(false),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  labelTsvector: tsvector("label_tsvector"),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIM }),
  embeddingModelId: text("embedding_model_id"), // FK to embedding_models.id
  // Int8 quantized embedding for 4x storage reduction (97%+ accuracy retention)
  // Format: 8-byte float64 scale + int8 data
  embeddingQuantized: customType<{ data: Uint8Array; driverData: Buffer }>({
    dataType() {
      return "bytea";
    },
  })("embedding_quantized"),
  // Access tracking for adaptive decay (reference: alfred-memory-review.md)
  // effective_half_life = base_half_life × (1 + log(1 + access_count))
  accessCount: integer("access_count").notNull().default(0),
  lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
});

// Index coverage:
// - label_tsvector is generated + GIN indexed (0034)

/**
 * Memory edges (relationships between nodes)
 *
 * Uses bi-temporal model (Zep-style) for non-destructive updates:
 * - valid_from/valid_to: When the relationship is valid in the real world
 * - created_at: When we recorded this edge (transaction time)
 *
 * Reference: alfred-memory-review.md - "Bi-temporal edges for non-lossy updates"
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
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  // Transaction time: when we learned about this edge
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  // Bi-temporal validity period: when the edge is/was valid in the real world
  // NULL valid_from = valid from the beginning of time
  // NULL valid_to = valid until the end of time (current)
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validTo: timestamp("valid_to", { withTimezone: true }),
});

// Index coverage:
// - (from_id, kind) and (to_id, kind) btree indexes (0035)
// - (from_id, kind, resource) and (to_id, kind, resource) compound indexes (0035)
// - kind-only index for type filtering (0035)

/**
 * Knowledge corrections (durable records for graph mutations)
 */
export const knowledgeCorrections = pgTable("knowledge_corrections", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  resource: text("resource").notNull(),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  targetType: text("target_type").notNull(), // "node" | "edge"
  targetId: uuid("target_id").notNull(),
  operation: text("operation").notNull(), // "update" | "delete"
  reason: text("reason").notNull(),
  previous: jsonb("previous"),
  patch: jsonb("patch"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Phase 4: add graph traversal helpers in repo layer.
// - getNeighbors(nodeId, direction, kind)
// - findPath(fromId, toId, maxDepth)
// - getSubgraph(nodeIds)
