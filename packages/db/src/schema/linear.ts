/**
 * ALFRED Linear Integration Schema
 * Linear OAuth installations and workspace tracking
 */

import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

// TODO: [Phase 7] Add proper indexes for Linear integration queries

/**
 * Linear installations (OAuth actor=app)
 */
export const linearInstallations = pgTable("linear_installations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(), // References better_auth.users
  organizationId: text("organization_id").notNull(), // Linear organization ID
  accessToken: text("access_token").notNull(), // Encrypted in production
  refreshToken: text("refresh_token"), // Encrypted in production
  scope: text("scope").notNull(), // Comma-separated scopes
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  metadata: jsonb("metadata"), // Organization name, logo, etc.
});

// TODO: [Phase 7] Add unique index on (userId, organizationId)
// TODO: [Phase 7] Add token encryption in auth layer
// TODO: [Phase 7] Add token refresh logic before expiry

// TODO: [Phase 7] Add linearWebhooks table for webhook event tracking
// export const linearWebhooks = pgTable("linear_webhooks", {
//   id: uuid("id").defaultRandom().primaryKey(),
//   installationId: uuid("installation_id").references(() => linearInstallations.id),
//   event: text("event").notNull(), // "Issue.create" | "Issue.update" | etc.
//   payload: jsonb("payload").notNull(),
//   processed: boolean("processed").default(false),
//   created: timestamp("created_at", { withTimezone: true }).defaultNow(),
// });
