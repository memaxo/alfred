/**
 * ALFRED Metric Alerts Schema
 * Stores user-configured metric alerts
 */

import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { projects } from "./project";

export const metricAlerts = pgTable("metric_alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  query: text("query").notNull(),
  condition: text("condition").notNull(),
  severity: text("severity").notNull().default("warning"),
  enabled: boolean("enabled").default(true).notNull(),
  lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
  triggerCount: integer("trigger_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type MetricAlert = typeof metricAlerts.$inferSelect;
export type MetricAlertInsert = typeof metricAlerts.$inferInsert;

// Alert severity type for type safety
export type AlertSeverity = "info" | "warning" | "critical";
