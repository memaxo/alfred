/**
 * @alfred/cortex
 *
 * WebGPU rendering engine for ALFRED Mindscape.
 * Provides 4D coordinate system, particle physics, and organic neural visualization.
 */

// Buffer management
export {
  BufferPool,
  DoubleBuffer,
  StorageBuffer,
  UniformBuffer,
} from "./buffer";
// Configuration and presets
export {
  animateConfig,
  applyPreset,
  applyVisualConfig,
  getVisualConfig,
  interpolateConfig,
  parseOklch,
  rgbToOklch,
  updateVisualConfig,
} from "./config";
export type { TemporalState } from "./coordinate";
// Coordinate system
export {
  computeNodeDepth,
  computeSemanticBasis,
  createCamera,
  createTemporalState,
  findBracketingStates,
  interpolateTemporal,
  lerpPoint4D,
  point4D,
  projectSemanticToXY,
  projectToScreen,
  recordState,
  screenToWorld,
} from "./coordinate";
export type { CortexConfig, EngineState } from "./engine";
// Core engine
export {
  CortexEngine,
  detectRenderingCapability,
  isWebGPUSupported,
} from "./engine";
// Fallback renderers
export * from "./fallback";
// Frame graph
export {
  buildStandardFrameGraph,
  createFrameGraphNode,
  FrameGraph,
  PASS_NAMES,
} from "./frame-graph";
// LOD and culling
export {
  computeLOD,
  getFiberSegments,
  isCircleInViewport,
  isEdgeInViewport,
  LODManager,
  SpatialIndex,
} from "./lod";
// Math utilities
export * from "./math";
export type { PresetMetadata } from "./presets";
export {
  getDefaultPreset,
  getPreset,
  mergeWithPreset,
  PRESET_BALANCED,
  PRESET_MAXIMUM,
  PRESET_METADATA,
  PRESET_MINIMAL,
  PRESET_PERFORMANCE,
  VISUAL_PRESETS,
} from "./presets";
export type { SemanticConfig, SemanticState } from "./semantic";
// Semantic projection
export {
  clearProjectionCache,
  computeCentroid,
  cosineSimilarity,
  createSemanticPoint4D,
  createSemanticState,
  DEFAULT_SEMANTIC_CONFIG,
  findNearestNeighbors,
  learnPCABasis,
  projectAndCache,
  projectEmbedding,
  setSemanticCenter,
  updateSemanticBasis,
} from "./semantic";

// Render systems
export * from "./systems";
// Types
export type {
  Camera,
  Color,
  EdgeData,
  FrameGraphNode,
  GlobalUniforms,
  LODLevel,
  NodeData,
  OrbConfig,
  OrbState,
  Particle,
  Point4D,
  PooledBuffer,
  Rect,
  RenderSystem,
  Vec2,
  Vec3,
  Vec4,
} from "./types";
