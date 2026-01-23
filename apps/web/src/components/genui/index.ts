/**
 * GenUI Module for ALFRED Web
 *
 * Re-exports genui utilities from @alfred/ui/genui
 * plus web-specific initialization.
 */

// Re-export types and type guards from type package
export {
  isGenUIToolResult,
  isUIDataPart,
  type UIComponent,
  type UIDataPart,
  type UIInterpreterOptions,
} from "@alfred/type/genui";
// Re-export core genui APIs from the package
export {
  canRender,
  containsFormComponents,
  // Error boundary
  GenUIErrorBoundary,
  // Rendering
  renderUISchema,
  resolveComponent,
  UISchemaRenderer,
  // Validation
  validateRenderable,
} from "@alfred/ui/genui";

// Web-specific initialization
export {
  initGenUIRegistry,
  isGenUIInitialized,
  resetGenUIRegistry,
} from "./registry";
