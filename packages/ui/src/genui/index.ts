/**
 * Generative UI Module
 *
 * Provides dynamic UI generation capabilities where the LLM
 * can return component schemas that are interpreted and rendered.
 *
 * @example
 * ```tsx
 * import {
 *   registerComponent,
 *   renderUISchema,
 *   UISchemaRenderer,
 * } from "@alfred/ui/genui";
 *
 * // Register components at app initialization
 * registerComponent("chart", ChartComponent);
 * registerComponent("grid", GridComponent);
 *
 * // Render a schema from LLM output
 * const schema = { component: "chart", props: { data: [...] } };
 * return <div>{renderUISchema(schema)}</div>;
 * ```
 */

// Type exports from @alfred/type
export type {
  GenUIToolResult,
  UIComponent,
  UIDataPart,
  UIInterpreterOptions,
  UISchemaValidationResult,
} from "@alfred/type/genui";

export { isGenUIToolResult, isUIDataPart } from "@alfred/type/genui";

// Zod schema exports
export {
  genUIToolResultSchema,
  uiComponentSchema,
  uiDataPartSchema,
  validateUIComponent,
  validateUIDataPart,
} from "@alfred/type/genui.zod";
// Error boundary exports
export {
  GenUIErrorBoundary,
  withGenUIErrorBoundary,
} from "./boundary";

// Interpreter exports
export {
  canRender,
  renderUISchema,
  UISchemaRenderer,
  validateRenderable,
} from "./interpreter";
// Orchestrator component exports
export type {
  Artifact,
  ArtifactBrowserProps,
  ErrorContext,
  ErrorPanelProps,
  OutputLine,
  ProgressWindowProps,
  ResourceInfo,
  ResourceMonitorProps,
  StreamingTerminalProps,
  TaskTrackerProps,
  WorkflowPhase,
  WorkflowTask,
  WorkflowTimelineProps,
} from "./orchestrator";
export {
  ArtifactBrowser,
  ErrorPanel,
  ProgressWindow,
  ResourceMonitor,
  StreamingTerminal,
  TaskTracker,
  WorkflowTimeline,
} from "./orchestrator";
// Registry exports
export {
  clearRegistry,
  getRegisteredComponents,
  hasComponent,
  registerComponent,
  registerComponents,
  registrySize,
  resolveComponent,
  unregisterComponent,
} from "./registry";
// Streaming exports
export type {
  StreamingGenUIConfig,
  StreamingGenUIResult,
  StreamingUIRendererProps,
} from "./streaming";
export {
  createGenUIObjectConfig,
  GenUISkeleton,
  isPartialSchemaRenderable,
  StreamingUIRenderer,
} from "./streaming";
// Tool integration exports
export {
  createArtifactsResult,
  createChartResult,
  createCodeResult,
  createErrorResult,
  createGenUIResult,
  createGridResult,
  createListResult,
  createLoadingResult,
  createPlanResult,
  createProgressResult,
  createResourceMonitorResult,
  createTaskResult,
  createTaskTrackerResult,
  // Orchestrator tool helpers
  createTerminalResult,
  createTermResult,
  createWorkflowResult,
} from "./tool";
