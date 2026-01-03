/**
 * Desktop Zod Schemas - Phase 0 Migration
 *
 * Validation schemas for the new desktop type system.
 *
 * @see docs/execplans/desktop-type-migration.md Section 5
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// GEOMETRY SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const boundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().min(100),
  height: z.number().min(100),
});

export const sizeSchema = z.object({
  width: z.number().min(0),
  height: z.number().min(0),
});

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW STATE SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const windowStateSchema = z.enum([
  "normal",
  "minimized",
  "maximized",
  "fullscreen",
]);

export const tileZoneSchema = z.enum([
  "left",
  "right",
  "top",
  "bottom",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "center",
  "full",
]);

export const viewModeSchema = z.enum(["compact", "full", "maximized"]);

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW TYPE SCHEMA — Extended for Phase 8 apps
// ─────────────────────────────────────────────────────────────────────────────

export const windowTypeSchema = z.enum([
  // Tier 0: Core Experience
  "chat",
  "terminal",
  "code",
  "agents",
  // Tier 1: System & Operations
  "taskmanager",
  "docker",
  "pr-review",
  "agentfs",
  "files",
  // Tier 2: Intelligence & Learning
  "cortex",
  "learning",
  "policy",
  "tune",
  "plan",
  "metrics",
  "rag",
  // Tier 3: Knowledge & Exploration
  "knowledge",
  "workflow",
  "linear",
  "concept",
  // Tier 4: Productivity & Settings
  "settings",
  "notes",
  "reminders",
  "todos",
  // Legacy
  "droid",
  "note",
  "reminder",
  "todo",
  "workflowlist",
  "integrations",
]);

// ─────────────────────────────────────────────────────────────────────────────
// RESOURCE SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const resourceTypeSchema = z.enum([
  "note",
  "reminder",
  "thread",
  "workflow_run",
  "preference",
  "integration",
  "knowledge",
  "concept",
]);

export const resourceRefSchema = z.object({
  type: resourceTypeSchema,
  id: z.string(),
});

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW DATA SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

export const windowDataSchema = z
  .object({
    type: windowTypeSchema,
    label: z.string().optional(),
    resourceRef: resourceRefSchema.optional(),
    viewMode: viewModeSchema.default("full"),
    draft: z.unknown().optional(),
  })
  .passthrough(); // Allow additional app-specific fields

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW INSTANCE SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

export const windowInstanceSchema = z.object({
  id: z.string(),
  type: windowTypeSchema,
  data: windowDataSchema,

  bounds: boundsSchema,
  state: windowStateSchema,

  isTiled: z.boolean(),
  tileZone: tileZoneSchema.optional(),

  zIndex: z.number(),
  isFocused: z.boolean(),

  minSize: sizeSchema,
  maxSize: sizeSchema.optional(),
  resizable: z.boolean(),

  createdAt: z.number(),
  lastFocusedAt: z.number(),
});

// ─────────────────────────────────────────────────────────────────────────────
// TILING SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const tilingLayoutSchema = z.enum([
  "float",
  "split-h",
  "split-v",
  "quad",
  "main-side",
  "stack",
  "columns",
]);

export const tilingConfigSchema = z.object({
  layout: tilingLayoutSchema,
  gap: z.number().min(0).max(32),
  mainRatio: z.number().min(0.3).max(0.8),
  respectMinSize: z.boolean(),
});

export const tilingZoneStateSchema = z.object({
  id: tileZoneSchema,
  bounds: boundsSchema,
  occupied: z.boolean(),
  windowId: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// VIEWPORT SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const desktopModeSchema = z.enum(["desktop", "mindscape"]);

export const desktopAreaSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

// ─────────────────────────────────────────────────────────────────────────────
// EDGE SCHEMAS — Shared with Mindscape
// ─────────────────────────────────────────────────────────────────────────────

export const edgeKindSchema = z.enum([
  "relates_to",
  "blocks",
  "depends_on",
  "data_flow",
  "explains",
  "contains",
  "member_of",
  "part_of",
]);

export const edgeMetadataSchema = z.object({
  source: z.enum(["user", "assistant", "import", "inference"]),
  confidence: z.number().min(0).max(1).optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  scope: z.string().optional(),
});

export const edgeDataSchema = z.object({
  kind: edgeKindSchema,
  metadata: edgeMetadataSchema.optional(),
  fromResourceId: z.string().optional(),
  toResourceId: z.string().optional(),
  scope: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export type Bounds = z.infer<typeof boundsSchema>;
export type Size = z.infer<typeof sizeSchema>;
export type WindowState = z.infer<typeof windowStateSchema>;
export type TileZone = z.infer<typeof tileZoneSchema>;
export type ViewMode = z.infer<typeof viewModeSchema>;
export type WindowType = z.infer<typeof windowTypeSchema>;
export type ResourceType = z.infer<typeof resourceTypeSchema>;
export type ResourceRef = z.infer<typeof resourceRefSchema>;
export type WindowData = z.infer<typeof windowDataSchema>;
export type WindowInstance = z.infer<typeof windowInstanceSchema>;
export type TilingLayout = z.infer<typeof tilingLayoutSchema>;
export type TilingConfig = z.infer<typeof tilingConfigSchema>;
export type TilingZoneState = z.infer<typeof tilingZoneStateSchema>;
export type DesktopMode = z.infer<typeof desktopModeSchema>;
export type DesktopArea = z.infer<typeof desktopAreaSchema>;
export type EdgeKind = z.infer<typeof edgeKindSchema>;
export type EdgeMetadata = z.infer<typeof edgeMetadataSchema>;
export type EdgeData = z.infer<typeof edgeDataSchema>;
