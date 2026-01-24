/**
 * Generative UI Schema Interpreter
 *
 * Renders UI component trees from schema definitions.
 * The interpreter resolves component names from the registry
 * and recursively renders nested children.
 */

import type { UIComponent, UIInterpreterOptions } from "@alfred/type/genui";
import type { ReactNode } from "react";

import { createElement, Fragment } from "react";

import { hasComponent, resolveComponent } from "./registry";

const DEFAULT_MAX_DEPTH = 10;

/**
 * Placeholder component for unknown component names.
 */
function UnknownComponent({
  name,
  props,
}: {
  name: string;
  props: Record<string, unknown>;
}): ReactNode {
  return (
    <div
      style={{
        padding: "8px 12px",
        border: "1px dashed #ccc",
        borderRadius: "4px",
        backgroundColor: "#f9f9f9",
        color: "#666",
        fontSize: "12px",
      }}
    >
      <strong>Unknown component:</strong> {name}
      {Object.keys(props).length > 0 && (
        <pre style={{ margin: "4px 0 0", fontSize: "10px", overflow: "auto" }}>
          {JSON.stringify(props, null, 2)}
        </pre>
      )}
    </div>
  );
}

/**
 * Error component for rendering failures.
 */
function ErrorComponent({
  error,
  component,
}: {
  error: Error;
  component: string;
}): ReactNode {
  return (
    <div
      style={{
        padding: "8px 12px",
        border: "1px solid #f5c6cb",
        borderRadius: "4px",
        backgroundColor: "#f8d7da",
        color: "#721c24",
        fontSize: "12px",
      }}
    >
      <strong>Render error in {component}:</strong>
      <div style={{ marginTop: "4px" }}>{error.message}</div>
    </div>
  );
}

/**
 * Render a single UI component from its schema.
 *
 * @param schema - The component schema to render
 * @param options - Interpreter options
 * @param depth - Current recursion depth
 * @returns Rendered React node
 */
function renderComponent(
  schema: UIComponent,
  options: UIInterpreterOptions,
  depth: number
): ReactNode {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const renderUnknown = options.renderUnknown ?? true;

  // Check depth limit
  if (depth > maxDepth) {
    return (
      <div style={{ color: "#856404", fontSize: "12px" }}>
        Max depth ({maxDepth}) exceeded
      </div>
    );
  }

  const { component: name, props, children, key } = schema;

  // Resolve the component from registry
  const Component = resolveComponent(name);

  // Handle unknown components
  if (!Component) {
    if (renderUnknown) {
      return <UnknownComponent key={key} name={name} props={props} />;
    }
    return null;
  }

  // Render children recursively
  let renderedChildren: ReactNode = null;
  if (children && children.length > 0) {
    renderedChildren = children.map((child, index) => {
      const childKey = child.key ?? `${name}-child-${index}`;
      return (
        <Fragment key={childKey}>
          {renderComponent({ ...child, key: childKey }, options, depth + 1)}
        </Fragment>
      );
    });
  }

  // Render the component with error boundary
  try {
    return createElement(Component, { ...props, key }, renderedChildren);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    options.onError?.(err, schema);
    return <ErrorComponent component={name} error={err} key={key} />;
  }
}

/**
 * Render a UI schema into React nodes.
 *
 * This is the main entry point for the interpreter.
 *
 * @param schema - The root component schema
 * @param options - Optional interpreter configuration
 * @returns Rendered React node
 *
 * @example
 * ```tsx
 * const schema: UIComponent = {
 *   component: "grid",
 *   props: { columns: 2 },
 *   children: [
 *     { component: "chart", props: { type: "bar", data: [...] } },
 *     { component: "list", props: { items: [...] } },
 *   ],
 * };
 *
 * return <div>{renderUISchema(schema)}</div>;
 * ```
 */
export function renderUISchema(
  schema: UIComponent,
  options: UIInterpreterOptions = {}
): ReactNode {
  return renderComponent(schema, options, 0);
}

/**
 * React component wrapper for rendering UI schemas.
 *
 * @example
 * ```tsx
 * <UISchemaRenderer schema={mySchema} maxDepth={5} />
 * ```
 */
export function UISchemaRenderer({
  schema,
  maxDepth,
  renderUnknown,
  onError,
}: {
  schema: UIComponent;
  maxDepth?: number;
  renderUnknown?: boolean;
  onError?: (error: Error, component: UIComponent) => void;
}): ReactNode {
  return renderUISchema(schema, { maxDepth, renderUnknown, onError });
}

/**
 * Check if a component can be rendered.
 *
 * @param name - Component name to check
 * @returns True if the component is available
 */
export function canRender(name: string): boolean {
  return hasComponent(name);
}

/**
 * Validate a UI schema can be rendered.
 *
 * Checks that all referenced components exist in the registry.
 *
 * @param schema - The schema to validate
 * @returns Object with valid flag and missing component names
 */
export function validateRenderable(schema: UIComponent): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  function check(s: UIComponent): void {
    if (!hasComponent(s.component)) {
      missing.push(s.component);
    }
    if (s.children) {
      for (const child of s.children) {
        check(child);
      }
    }
  }

  check(schema);
  return { valid: missing.length === 0, missing };
}
