/**
 * ALFRED Linear Integration Schema
 * Linear OAuth installations and workspace tracking
 */

import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Linear installations (OAuth actor=app)
 */
export const linearInstallations = pgTable("linear_installations", {
  id: uuid("id").defaultRandom().primaryKey(),
  oauthClient: text("oauth_client_id").notNull(),
  appUser: text("app_user_id").notNull(),
  space: text("workspace_id").notNull(),
  token: text("access_token").notNull(),
  refresh: text("refresh_token"),
  scope: text("scope").notNull(),
  expires: timestamp("expires_at", { withTimezone: true }),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  metadata: jsonb("metadata"),
});

// NOTE: Indexes and unique constraints are applied via migrations.
