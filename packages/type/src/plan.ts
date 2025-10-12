/**
 * ALFRED Implementation Plan Types
 * Zod schemas for Orchestrator planning workflow
 */

import { z } from "zod";

// TODO: [Phase 4] Refine schemas based on actual Orchestrator workflow requirements

/**
 * Task represents a single unit of work
 */
export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(["pending", "in_progress", "completed", "failed"]),
  assigned: z.string().optional(), // Droid or agent name
  dependencies: z.array(z.string()).default([]), // Task IDs
  auto: z.enum(["read", "low", "medium", "high"]).default("read"),
  created: z.date().default(() => new Date()),
  started: z.date().optional(),
  completed: z.date().optional(),
  error: z.string().optional(),
});

export type Task = z.infer<typeof taskSchema>;

/**
 * ModulePlan represents work for a single module/file
 */
export const modulePlanSchema = z.object({
  id: z.string(),
  path: z.string(), // File path relative to project root
  description: z.string(),
  tasks: z.array(taskSchema),
  status: z.enum(["pending", "in_progress", "completed", "failed"]),
  branch: z.string().optional(), // Git branch if using worktrees
  worktree: z.string().optional(), // Worktree path
});

export type ModulePlan = z.infer<typeof modulePlanSchema>;

/**
 * ImplementationPlan is the top-level plan from Orchestrator
 */
export const implementationPlanSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  ticket: z.string().optional(), // Linear ticket ID
  modules: z.array(modulePlanSchema),
  strategy: z.enum(["sequential", "parallel"]).default("sequential"),
  status: z.enum(["planning", "scheduled", "executing", "reviewing", "completed", "failed"]),
  created: z.date().default(() => new Date()),
  started: z.date().optional(),
  completed: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ImplementationPlan = z.infer<typeof implementationPlanSchema>;

// TODO: [Phase 4] Add validation helpers
// export function validatePlan(plan: unknown): ImplementationPlan {
//   return implementationPlanSchema.parse(plan);
// }

// TODO: [Phase 4] Add plan transformation utilities
// export function mergePlans(plans: ImplementationPlan[]): ImplementationPlan {
//   // Merge multiple plans into one
// }

export const droidArtifactSchema = z.object({
  path: z.string(),
  kind: z.string(),
});

export type DroidArtifact = z.infer<typeof droidArtifactSchema>;

export type WorkflowEvent =
  | { type: "progress"; pct?: number; message?: string }
  | { type: "stdout"; text: string }
  | { type: "stderr"; text: string }
  | { type: "droid"; chunk: unknown }
  | { type: "notice"; message: string }
  | { type: "data-cache-handoff"; key: readonly unknown[]; value: unknown }
  | { type: string; [key: string]: unknown };
