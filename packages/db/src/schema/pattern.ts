import {
  bigint,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { projects } from "./project";
import { user } from "./auth";
import { EMBEDDING_DIM } from "@alfred/embed";

export const workflowPatterns = pgTable("workflow_patterns", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  trigger: text("trigger").notNull(),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIM }),
  planTemplate: jsonb("plan_template").notNull(),
  successRate: numeric("success_rate", { precision: 5, scale: 4 })
    .notNull()
    .default("0.0000"),
  avgDurationMs: bigint("avg_duration_ms", { mode: "number" }).notNull(),
  usageCount: integer("usage_count").notNull().default(1),
  knowledgeNodeId: uuid("knowledge_node_id"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
