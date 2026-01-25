import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export type McpTransport = "http" | "sse" | "streamable-http";
export type McpAuthType = "none" | "bearer" | "oauth";

export interface McpAuth {
  bearerEnv?: string | null;
}

export const mcpServers = pgTable("mcp_servers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  transport: text("transport").notNull().default("http"),
  url: text("url").notNull(),
  authType: text("auth_type").notNull().default("none"),
  auth: jsonb("auth").$type<McpAuth>(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type McpServer = typeof mcpServers.$inferSelect;
export type McpServerInsert = typeof mcpServers.$inferInsert;
