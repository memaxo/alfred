import {
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Home Entities Cache
 * Maps provider-specific devices to ALFRED's unified home taxonomy
 */
export const homeEntities = pgTable("home_entities", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  entityId: text("entity_id").notNull().unique(), // Unified ID: pillar.provider.internal_id
  pillar: text("pillar").notNull(), // network, media, security, presence, utility
  domain: text("domain").notNull(), // person, camera, router, series
  name: text("name").notNull(),
  state: text("state").notNull(),
  attributes: jsonb("attributes").default({}).notNull(),
  confidence: real("confidence"),
  provider: text("provider").notNull(),
  lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * Home Events Log
 * Time-series of significant events for AI reasoning and auditing
 */
export const homeEvents = pgTable("home_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  entityId: text("entity_id").notNull(),
  pillar: text("pillar").notNull(),
  type: text("type").notNull(), // intruder_detected, download_started, etc.
  severity: text("severity").notNull(), // info, low, medium, high, critical
  message: text("message").notNull(),
  data: jsonb("data").default({}).notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Home Preferences (Domain-specific overrides)
 */
export const homePreferences = pgTable("home_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  entityId: text("entity_id").notNull(),
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  source: text("source").default("user"), // user, learned
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
