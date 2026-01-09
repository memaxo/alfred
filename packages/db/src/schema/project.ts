// packages/db/src/schema/project.ts
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  workspace: text("workspace").notNull(),
  linearSpaceId: text("linear_space_id"),
  linearProjectId: text("linear_project_id"),
  linearTeamId: text("linear_team_id"),
  config: jsonb("config").default({}),
  conventions: jsonb("conventions").default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
