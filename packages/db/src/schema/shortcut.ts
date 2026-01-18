/**
 * Keyboard Shortcuts Schema
 */

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const keyboardShortcuts = pgTable("keyboard_shortcuts", {
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  shortcut: text("shortcut").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
