import type { UIMessage } from "@alfred/type/stream";

import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { projects } from "./project";

export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  title: text("title"),
  workflowId: uuid("workflow_id"),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
  parts: jsonb("parts").notNull().$type<UIMessage["parts"]>(),
  metadata: jsonb("metadata").$type<UIMessage["metadata"]>(),
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
