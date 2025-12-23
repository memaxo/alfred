/**
 * Memory Tools Index
 *
 * Exports all explicit memory tools for the ALFRED agent.
 * These tools give the agent direct control over the knowledge graph
 * and conversation history.
 */

export * from "./metrics";
export { type ToolMemoryBoost, toolMemoryBoost } from "./boost";
// Re-export embedding utilities
export { embedQuery, embedTexts, normalizeEmbedding } from "./embed";
export { type ToolMemoryHistory, toolMemoryHistory } from "./history";
export { type ToolMemoryRemove, toolMemoryRemove } from "./remove";
export { type ToolMemoryRetrieve, toolMemoryRetrieve } from "./retrieve";
export { type ToolMemorySearch, toolMemorySearch } from "./search";
export { type ToolMemoryStats, toolMemoryStats } from "./stats";
export { type ToolMemoryTraverse, toolMemoryTraverse } from "./traverse";
export { type ToolMemoryUpdate, toolMemoryUpdate } from "./update";

import { toolMemoryBoost } from "./boost";
import { toolMemoryHistory } from "./history";
import { toolMemoryRemove } from "./remove";
import { toolMemoryRetrieve } from "./retrieve";
// Collection of all memory tools for easy registration
import { toolMemorySearch } from "./search";
import { toolMemoryStats } from "./stats";
import { toolMemoryTraverse } from "./traverse";
import { toolMemoryUpdate } from "./update";

/**
 * All memory tools as an array for batch registration.
 */
export const memoryTools = [
  toolMemorySearch,
  toolMemoryRetrieve,
  toolMemoryUpdate,
  toolMemoryRemove,
  toolMemoryBoost,
  toolMemoryTraverse,
  toolMemoryHistory,
  toolMemoryStats,
] as const;

/**
 * Memory tools as a record keyed by tool name.
 */
export const memoryToolsByName = {
  memory_search: toolMemorySearch,
  memory_retrieve: toolMemoryRetrieve,
  memory_update: toolMemoryUpdate,
  memory_remove: toolMemoryRemove,
  memory_boost: toolMemoryBoost,
  memory_traverse: toolMemoryTraverse,
  memory_history: toolMemoryHistory,
  memory_stats: toolMemoryStats,
} as const;

export type MemoryToolName = keyof typeof memoryToolsByName;
