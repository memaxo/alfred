import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { conversations } from "./conversation";
import { user } from "./auth";
import { workflowRuns } from "./workflow";

export type FocusSetStatus = "active" | "closed";

export const focusSets = pgTable("focus_sets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title"),
  status: text("status").$type<FocusSetStatus>().notNull().default("active"),
  wipLimit: integer("wip_limit").notNull().default(5),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  lastTouchedAt: timestamp("last_touched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type FocusLane = "spotlight" | "background" | "maintenance";
export type FocusCommitmentStatus = "active" | "paused" | "done" | "cancelled";

export const focusCommitments = pgTable("focus_commitments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  focusSetId: uuid("focus_set_id")
    .notNull()
    .references(() => focusSets.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status")
    .$type<FocusCommitmentStatus>()
    .notNull()
    .default("active"),
  lane: text("lane").$type<FocusLane>().notNull().default("background"),
  priority: integer("priority").notNull().default(0),
  workflowRunId: uuid("workflow_run_id").references(() => workflowRuns.id, {
    onDelete: "set null",
  }),
  conversationId: uuid("conversation_id").references(() => conversations.id, {
    onDelete: "set null",
  }),
  lastTouchedAt: timestamp("last_touched_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type FocusSet = typeof focusSets.$inferSelect;
export type NewFocusSet = typeof focusSets.$inferInsert;
export type FocusCommitment = typeof focusCommitments.$inferSelect;
export type NewFocusCommitment = typeof focusCommitments.$inferInsert;

