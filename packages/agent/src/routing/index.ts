/**
 * Tool routing module - intent-based catalog selection.
 *
 * Exports the routing system for mapping user intents to appropriate
 * tool catalogs while maintaining AI SDK v6 hygiene (≤5 tools per agent).
 */

export {
  INTENT_CATEGORIES,
  TOOL_CATALOGS,
  getCatalogForIntent,
  getToolsForCapability,
  hasToolCoverage,
  routeToolsByIntent,
  type IntentCategory,
  type ToolCatalog,
} from "./intent.js";
