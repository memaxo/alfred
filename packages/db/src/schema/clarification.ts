import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { workflowRuns } from "./workflow";

export const clarificationRequests = pgTable("clarification_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => workflowRuns.id, { onDelete: "cascade" }),
  phaseId: text("phase_id"),
  agentId: text("agent_id"),
  question: text("question").notNull(),
  options: jsonb("options"), // string[]
  response: text("response"),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
