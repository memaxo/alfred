/**
 * ALFRED Deployments Schema
 * Track app deployments (preview/production)
 */

import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { projects } from "./project";

// Index coverage: migrations 0042 add deployment query indexes.

/**
 * Deployments (apps deployed by Alfred)
 */
export const deployments = pgTable("deployments", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  app: text("app").notNull(), // App name/identifier
  type: text("type").notNull().default("preview"), // "preview" | "production"
  status: text("status").notNull().default("pending"), // "pending" | "building" | "running" | "failed" | "stopped"
  domain: text("domain"), // Route domain (e.g., preview.example.com)
  url: text("url"), // Public URL (e.g., https://app-preview-123.alfred.local)
  branch: text("branch"), // Git branch
  commit: text("commit"), // Git commit SHA
  containerName: text("container_name"), // Human-readable container name
  containerId: text("container_id"), // Docker container ID
  lxcId: text("lxc_id"), // Proxmox LXC ID (if using LXC)
  port: integer("port"), // Internal port
  ports: jsonb("ports"), // Array of host/container port mappings
  healthUrl: text("health_url"), // Health check endpoint
  lastHealthCheck: timestamp("last_health_check", { withTimezone: true }),
  healthStatus: text("health_status"), // "healthy" | "unhealthy" | "unknown"
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deployed: timestamp("deployed_at", { withTimezone: true }),
  stopped: timestamp("stopped_at", { withTimezone: true }),
  metadata: jsonb("metadata"), // Arbitrary deployment metadata
});

// Index coverage: see deployments_* indexes in migration 0042 for these patterns.

// Phase 10: add deploymentLogs table for build/runtime logs.
// export const deploymentLogs = pgTable("deployment_logs", {
//   id: uuid("id").defaultRandom().primaryKey(),
//   deploymentId: uuid("deployment_id").references(() => deployments.id, { onDelete: "cascade" }),
//   level: text("level").notNull(), // "debug" | "info" | "warn" | "error"
//   message: text("message").notNull(),
//   timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
// });
