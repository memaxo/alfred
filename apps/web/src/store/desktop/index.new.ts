/**
 * Desktop Store - Phase 0 Migration (No ReactFlow)
 *
 * This is the new desktop store without ReactFlow dependencies.
 * It exports the new type system and slice creators for gradual migration.
 *
 * Usage during migration:
 * - Import from './index' for legacy (ReactFlow) behavior
 * - Import from './index.new' for new (DOM-based) behavior
 *
 * After migration is complete, this file will replace index.ts
 *
 * @see docs/execplans/desktop-type-migration.md
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Re-export schemas (excluding duplicates already in types.new)
export {
  boundsSchema,
  desktopAreaSchema,
  desktopModeSchema,
  edgeDataSchema,
  edgeKindSchema,
  edgeMetadataSchema,
  resourceRefSchema,
  resourceTypeSchema,
  sizeSchema,
  tileZoneSchema,
  tilingConfigSchema,
  tilingLayoutSchema,
  tilingZoneStateSchema,
  viewModeSchema,
  windowDataSchema,
  windowInstanceSchema,
  windowStateSchema,
  windowTypeSchema,
} from "../desktop.schemas.new";
export * from "./types.new";

// ─────────────────────────────────────────────────────────────────────────────
// SLICE CREATORS
// ─────────────────────────────────────────────────────────────────────────────

// Re-export unchanged slices
export { createCacheSlice } from "./cache";
export { createContextSlice } from "./context";
export { createTaskbarSlice } from "./taskbar";
export { createTilingSlice } from "./tiling";
export { createViewportSliceNew } from "./viewport.new";
export { createWindowSliceNew } from "./windows.new";

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────────

export { DESKTOP_STORAGE_ID, persistOptions } from "./persist";

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

export * from "./selectors";
