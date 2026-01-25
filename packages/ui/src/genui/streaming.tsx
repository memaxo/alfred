/**
 * Streaming GenUI Support
 *
 * Provides hooks and components for streaming UI schema generation.
 * Uses AI SDK's useObject pattern for progressive object streaming.
 */

import type { UIComponent, UIInterpreterOptions } from "@alfred/type/genui";
import type { ReactNode } from "react";

import { uiComponentSchema } from "@alfred/type/genui.zod";
import { createElement } from "react";

import { GenUIErrorBoundary } from "./boundary";
import { renderUISchema } from "./interpreter";

/**
 * Configuration for streaming GenUI.
 */
export interface StreamingGenUIConfig {
  /** API endpoint for streaming UI schema */
  api: string;
  /** Custom fetch function (optional) */
  fetch?: typeof fetch;
  /** Request headers (optional) */
  headers?: Record<string, string>;
  /** Credentials mode (optional) */
  credentials?: RequestCredentials;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
  /** Called when streaming completes */
  onFinish?: (result: {
    object: UIComponent | undefined;
    error?: unknown;
  }) => void;
}

/**
 * Return type for useStreamingGenUI hook.
 */
export interface StreamingGenUIResult {
  /** The current partial UI schema */
  schema: Partial<UIComponent> | undefined;
  /** Whether streaming is in progress */
  isStreaming: boolean;
  /** Any error that occurred */
  error: Error | undefined;
  /** Submit a prompt to generate UI */
  submit: (input: string) => void;
  /** Stop the current stream */
  stop: () => void;
  /** Clear the current schema */
  clear: () => void;
}

/**
 * Skeleton component for loading states.
 */
export function GenUISkeleton({
  variant = "default",
  className,
}: {
  variant?: "default" | "chart" | "list" | "card";
  className?: string;
}): ReactNode {
  const baseStyle = {
    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
    backgroundColor: "rgba(156, 163, 175, 0.2)",
    borderRadius: "6px",
  };

  if (variant === "chart") {
    return createElement("div", {
      className,
      style: { ...baseStyle, height: "200px", width: "100%" },
    });
  }

  if (variant === "list") {
    return createElement(
      "div",
      {
        className,
        style: { display: "flex", flexDirection: "column", gap: "8px" },
      },
      Array.from({ length: 3 }).map((_, i) =>
        createElement("div", {
          key: i,
          style: { ...baseStyle, height: "24px", width: `${80 - i * 10}%` },
        })
      )
    );
  }

  if (variant === "card") {
    return createElement(
      "div",
      {
        className,
        style: {
          ...baseStyle,
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        },
      },
      createElement("div", {
        style: { ...baseStyle, height: "20px", width: "60%" },
      }),
      createElement("div", {
        style: { ...baseStyle, height: "100px", width: "100%" },
      }),
      createElement("div", {
        style: { ...baseStyle, height: "16px", width: "40%" },
      })
    );
  }

  // Default skeleton
  return createElement("div", {
    className,
    style: { ...baseStyle, height: "100px", width: "100%" },
  });
}

/**
 * Infer skeleton variant from component name.
 */
function inferSkeletonVariant(
  componentName: string | undefined
): "default" | "chart" | "list" | "card" {
  if (!componentName) {
    return "default";
  }

  const name = componentName.toLowerCase();
  if (
    name.includes("chart") ||
    name.includes("graph") ||
    name.includes("viz")
  ) {
    return "chart";
  }
  if (
    name.includes("list") ||
    name.includes("queue") ||
    name.includes("term")
  ) {
    return "list";
  }
  if (
    name.includes("card") ||
    name.includes("panel") ||
    name.includes("grid")
  ) {
    return "card";
  }
  return "default";
}

/**
 * Props for StreamingUIRenderer component.
 */
export interface StreamingUIRendererProps {
  /** The partial schema being streamed */
  schema: Partial<UIComponent> | undefined;
  /** Whether streaming is in progress */
  isStreaming: boolean;
  /** Custom skeleton component (optional) */
  skeleton?: ReactNode;
  /** Interpreter options (optional) */
  options?: UIInterpreterOptions;
  /** Additional className */
  className?: string;
}

/**
 * Renders a streaming UI schema with skeleton loading states.
 *
 * Shows a skeleton while the schema is incomplete, then renders
 * the full UI once the schema is complete.
 *
 * @example
 * ```tsx
 * const { schema, isStreaming, submit } = useStreamingGenUI({ api: '/api/genui' });
 *
 * return (
 *   <div>
 *     <button onClick={() => submit('Show task progress')}>Generate</button>
 *     <StreamingUIRenderer schema={schema} isStreaming={isStreaming} />
 *   </div>
 * );
 * ```
 */
export function StreamingUIRenderer({
  schema,
  isStreaming,
  skeleton,
  options,
  className,
}: StreamingUIRendererProps): ReactNode {
  // Determine if schema is complete enough to render
  const isComplete = isPartialSchemaRenderable(schema);

  // Show skeleton while streaming and incomplete
  if (isStreaming && !isComplete) {
    if (skeleton) {
      return skeleton;
    }
    const variant = inferSkeletonVariant(schema?.component);
    return createElement(GenUISkeleton, { variant, className });
  }

  // Nothing to render
  if (!(schema && isComplete)) {
    return null;
  }

  // Render the complete schema
  const completeSchema = schema as UIComponent;

  const content = createElement(
    "div",
    { className },
    renderUISchema(completeSchema, options)
  );

  return createElement(GenUIErrorBoundary, {
    schema: completeSchema,
    children: content,
  });
}

/**
 * Create the useObject configuration for GenUI streaming.
 *
 * This helper creates the configuration needed to use AI SDK's
 * useObject hook with GenUI schemas.
 *
 * @example
 * ```typescript
 * import { experimental_useObject as useObject } from '@ai-sdk/react';
 *
 * const config = createGenUIObjectConfig({
 *   api: '/api/genui',
 *   onFinish: (result) => console.log('Complete:', result),
 * });
 *
 * const { object, submit, isLoading } = useObject(config);
 * ```
 */
export function createGenUIObjectConfig(config: StreamingGenUIConfig) {
  return {
    api: config.api,
    schema: uiComponentSchema,
    fetch: config.fetch,
    headers: config.headers,
    credentials: config.credentials,
    onError: config.onError,
    onFinish: config.onFinish
      ? (result: { object: UIComponent | undefined; error?: unknown }) =>
          config.onFinish?.(result)
      : undefined,
  };
}

/**
 * Validate a partial schema during streaming.
 *
 * Returns true if the partial schema has enough data to attempt rendering.
 */
export function isPartialSchemaRenderable(
  schema: Partial<UIComponent> | undefined
): schema is UIComponent {
  if (!schema) {
    return false;
  }
  return typeof schema.component === "string" && schema.component.length > 0;
}
