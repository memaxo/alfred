/**
 * GenUI Module for ALFRED Web
 *
 * Re-exports genui utilities from @alfred/ui/genui
 * plus web-specific initialization.
 */

// Re-export core genui APIs from the package
export {
  type Artifact,
  ArtifactBrowser,
  type ArtifactBrowserProps,
  canRender,
  createArtifactsResult,
  createChartResult,
  createCodeResult,
  createErrorResult,
  createGenUIObjectConfig,
  // Tool integration
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
  type ErrorContext,
  ErrorPanel,
  type ErrorPanelProps,
  // Error boundary
  GenUIErrorBoundary,
  GenUISkeleton,
  type GenUIToolResult,
  getRegisteredComponents,
  hasComponent,
  isGenUIToolResult,
  isPartialSchemaRenderable,
  // Type guards
  isUIDataPart,
  // Orchestrator components
  type OutputLine,
  ProgressWindow,
  type ProgressWindowProps,
  type ResourceInfo,
  ResourceMonitor,
  type ResourceMonitorProps,
  // Registry
  registerComponent,
  registerComponents,
  // Rendering
  renderUISchema,
  resolveComponent,
  // Streaming
  type StreamingGenUIConfig,
  type StreamingGenUIResult,
  StreamingTerminal,
  type StreamingTerminalProps,
  StreamingUIRenderer,
  type StreamingUIRendererProps,
  TaskTracker,
  type TaskTrackerProps,
  // Types
  type UIComponent,
  type UIDataPart,
  type UIInterpreterOptions,
  UISchemaRenderer,
  validateRenderable,
  // Validation
  validateUIComponent,
  validateUIDataPart,
  type WorkflowPhase,
  type WorkflowTask,
  WorkflowTimeline,
  type WorkflowTimelineProps,
  withGenUIErrorBoundary,
} from "@alfred/ui/genui";

// Web-specific initialization
export {
  initGenUIRegistry,
  isGenUIInitialized,
  resetGenUIRegistry,
} from "./registry";
