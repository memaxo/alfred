/**
 * Notification Preferences Schema
 */

import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const notificationPreferences = pgTable("notification_preferences", {
  userId: text("user_id").primaryKey(),
  agentCompletions: boolean("agent_completions").notNull().default(true),
  workflowEvents: boolean("workflow_events").notNull().default(true),
  systemAlerts: boolean("system_alerts").notNull().default(true),
  snoozeUntil: timestamp("snooze_until"),
  vacationStart: timestamp("vacation_start"),
  vacationEnd: timestamp("vacation_end"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
