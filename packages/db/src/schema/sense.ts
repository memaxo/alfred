/**
 * ALFRED Sense Schema
 * Capture inbox, bundles, receipts, and working set
 */

import {
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export type SenseCaptureStatus = "new" | "triaged" | "converted" | "archived";
export type SenseCaptureKind = "text" | "voice" | "photo";

export const senseCaptures = pgTable("sense_captures", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  kind: text("kind").$type<SenseCaptureKind>().notNull(),
  status: text("status").$type<SenseCaptureStatus>().notNull().default("new"),
  sourceDevice: text("source_device"),
  evidence: jsonb("evidence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const senseBundles = pgTable("sense_bundles", {
  id: uuid("id").defaultRandom().primaryKey(),
  captureId: uuid("capture_id").notNull(),
  text: text("text").notNull(),
  entities: jsonb("entities"),
  routeCandidates: jsonb("route_candidates"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type SenseReceiptDecision = "route" | "schedule" | "link" | "suggest";

export const senseReceipts = pgTable("sense_receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  captureId: uuid("capture_id").notNull(),
  decision: text("decision")
    .$type<SenseReceiptDecision>()
    .notNull()
    .default("route"),
  summary: text("summary").notNull(),
  evidence: jsonb("evidence").notNull(),
  outcome: jsonb("outcome").notNull(),
  alternatives: jsonb("alternatives").notNull(),
  confidence: real("confidence").notNull().default(0.5),
  corrections: jsonb("corrections").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const senseWorkingsets = pgTable("sense_workingsets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  items: jsonb("items").notNull(),
  focus: jsonb("focus"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type SenseCaptureRow = typeof senseCaptures.$inferSelect;
export type NewSenseCaptureRow = typeof senseCaptures.$inferInsert;
export type SenseBundleRow = typeof senseBundles.$inferSelect;
export type NewSenseBundleRow = typeof senseBundles.$inferInsert;
export type SenseReceiptRow = typeof senseReceipts.$inferSelect;
export type NewSenseReceiptRow = typeof senseReceipts.$inferInsert;
export type SenseWorkingsetRow = typeof senseWorkingsets.$inferSelect;
export type NewSenseWorkingsetRow = typeof senseWorkingsets.$inferInsert;
