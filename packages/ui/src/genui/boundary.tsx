/**
 * GenUI Error Boundary
 *
 * Provides graceful degradation for generative UI rendering failures.
 * Catches render errors and displays a fallback UI while logging
 * the error for debugging.
 */

import type { UIComponent } from "@alfred/type/genui";
import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

type GenUIErrorBoundaryProps = {
  /** The child content to render */
  children: ReactNode;
  /** The schema being rendered (for error reporting) */
  schema?: UIComponent;
  /** Custom fallback UI (optional) */
  fallback?: ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo, schema?: UIComponent) => void;
};

type GenUIErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

/**
 * Default fallback component shown when rendering fails.
 */
function DefaultFallback({
  error,
  schema,
}: {
  error: Error;
  schema?: UIComponent;
}) {
  return (
    <div
      role="alert"
      style={{
        padding: "12px 16px",
        border: "1px solid #f5c6cb",
        borderRadius: "6px",
        backgroundColor: "#f8d7da",
        color: "#721c24",
        fontSize: "13px",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: "4px" }}>
        Component render failed
      </div>
      <div style={{ fontSize: "12px", opacity: 0.9 }}>{error.message}</div>
      {schema && (
        <div
          style={{
            marginTop: "8px",
            padding: "8px",
            backgroundColor: "rgba(0,0,0,0.05)",
            borderRadius: "4px",
            fontSize: "11px",
            fontFamily: "monospace",
          }}
        >
          Component: {schema.component}
        </div>
      )}
    </div>
  );
}

/**
 * Error boundary for GenUI schema rendering.
 *
 * Wraps generative UI content to catch and handle render errors gracefully.
 *
 * @example
 * ```tsx
 * <GenUIErrorBoundary
 *   schema={mySchema}
 *   onError={(err, info) => console.error('GenUI render failed:', err)}
 * >
 *   <UISchemaRenderer schema={mySchema} />
 * </GenUIErrorBoundary>
 * ```
 */
export class GenUIErrorBoundary extends Component<
  GenUIErrorBoundaryProps,
  GenUIErrorBoundaryState
> {
  constructor(props: GenUIErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): GenUIErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo, this.props.schema);
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <DefaultFallback error={this.state.error} schema={this.props.schema} />
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component that wraps a component with GenUI error boundary.
 *
 * @param WrappedComponent - Component to wrap
 * @param options - Error boundary options
 * @returns Wrapped component with error boundary
 */
export function withGenUIErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: {
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
  }
): React.FC<P> {
  const displayName =
    WrappedComponent.displayName || WrappedComponent.name || "Component";

  const WithErrorBoundary: React.FC<P> = (props) => (
    <GenUIErrorBoundary fallback={options?.fallback} onError={options?.onError}>
      <WrappedComponent {...props} />
    </GenUIErrorBoundary>
  );

  WithErrorBoundary.displayName = `withGenUIErrorBoundary(${displayName})`;

  return WithErrorBoundary;
}
