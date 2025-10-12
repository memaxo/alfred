/**
 * ALFRED Evaluation Schema
 * Definitions, datasets, datapoints, runs, and scores for agent evals.
 */

import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  doublePrecision,
} from "drizzle-orm/pg-core";

export const evalDefs = pgTable("eval_defs", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  agent: text("agent").notNull(),
  title: text("title"),
  description: text("description"),
  config: jsonb("config"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const evalDatasets = pgTable("eval_datasets", {
  id: uuid("id").defaultRandom().primaryKey(),
  defId: uuid("def_id")
    .notNull()
    .references(() => evalDefs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  source: text("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const evalPoints = pgTable("eval_points", {
  id: uuid("id").defaultRandom().primaryKey(),
  datasetId: uuid("dataset_id")
    .notNull()
    .references(() => evalDatasets.id, { onDelete: "cascade" }),
  input: jsonb("input").notNull(),
  target: jsonb("target"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const evalRuns = pgTable("eval_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  defId: uuid("def_id")
    .notNull()
    .references(() => evalDefs.id, { onDelete: "cascade" }),
  datasetId: uuid("dataset_id")
    .notNull()
    .references(() => evalDatasets.id, { onDelete: "cascade" }),
  variant: text("variant"),
  status: text("status").notNull().default("queued"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  stats: jsonb("stats"),
  laminarEvalId: text("laminar_eval_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const evalScores = pgTable("eval_scores", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => evalRuns.id, { onDelete: "cascade" }),
  pointId: uuid("point_id")
    .notNull()
    .references(() => evalPoints.id, { onDelete: "cascade" }),
  scorer: text("scorer").notNull(),
  score: doublePrecision("score").notNull(),
  reason: jsonb("reason"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
