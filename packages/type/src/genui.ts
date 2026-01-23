/**
 * Generative UI Types
 *
 * Type definitions for LLM-generated dynamic UI components.
 * The model can return UIComponent schemas that describe component trees,
 * which the client interprets and renders using the component manifest.
 */

/**
 * Schema context for GenUI generation and enrichment.
 *
 * Provides context about the user, surface, and mode to guide
 * schema generation and component selection.
 */
export type SchemaContext = {
  userId?: string;
  projectId?: string;
  surface: "web" | "mobile" | "voice" | "tui";
  mode: "assistant" | "workflow" | "focus";
  viewport?: { width?: number; height?: number };
  preference?: { verbosity?: "compact" | "normal" | "verbose" };
};

/**
 * A single UI component specification.
 *
 * The `component` field references a name from the component manifest.
 * The `props` field contains component-specific properties.
 * The `children` field enables nested component composition.
 */
export type UIComponent = {
  /** Component name from the manifest (e.g., "chart", "grid", "task") */
  component: string;
  /** Component props as key-value pairs */
  props: Record<string, unknown>;
  /** Optional nested child components */
  children?: UIComponent[];
  /** Optional unique key for React reconciliation */
  key?: string;
};

/**
 * A data-ui message part containing a UI schema.
 *
 * This part type is used in AI SDK messages to embed generative UI.
 */
export type UIDataPart = {
  type: "data-ui";
  /** The UI component tree to render */
  ui: UIComponent;
  /** Optional identifier for the part */
  id?: string;
};

/**
 * Result of validating a UI schema.
 */
export type UISchemaValidationResult =
  | { valid: true; component: UIComponent }
  | { valid: false; errors: string[] };

/**
 * Options for the UI schema interpreter.
 */
export type UIInterpreterOptions = {
  /** Maximum depth for nested component trees (default: 10) */
  maxDepth?: number;
  /** Whether to render unknown components as placeholders (default: true) */
  renderUnknown?: boolean;
  /** Custom error handler for rendering failures */
  onError?: (error: Error, component: UIComponent) => void;
};

/**
 * A tool result that includes generative UI.
 *
 * Tools can return this structure to provide both data and UI.
 */
export type GenUIToolResult<T = unknown> = {
  /** The UI component tree to render */
  ui: UIComponent;
  /** The underlying data (for serialization/persistence) */
  data: T;
};

/**
 * Check if a value is a GenUIToolResult.
 */
export function isGenUIToolResult(value: unknown): value is GenUIToolResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.ui === "object" &&
    obj.ui !== null &&
    typeof (obj.ui as Record<string, unknown>).component === "string"
  );
}

/**
 * Check if a message part is a UIDataPart.
 */
export function isUIDataPart(part: unknown): part is UIDataPart {
  if (typeof part !== "object" || part === null) {
    return false;
  }
  const obj = part as Record<string, unknown>;
  return (
    obj.type === "data-ui" &&
    typeof obj.ui === "object" &&
    obj.ui !== null &&
    typeof (obj.ui as Record<string, unknown>).component === "string"
  );
}
